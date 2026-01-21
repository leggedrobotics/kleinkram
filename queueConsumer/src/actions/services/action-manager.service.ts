import { tracing } from '@/tracing';
import {
    AccessControlService,
    ActionEntity,
    ApiKeyEntity,
    Image,
} from '@kleinkram/backend-common';
import { ActionRunnerEntity } from '@kleinkram/backend-common/entities/action/action-runner.entity';
import {
    AccessGroupRights,
    ActionState,
    KeyTypes,
    UserRole,
} from '@kleinkram/shared';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Dockerode from 'dockerode';
import fs from 'node:fs';
import path from 'node:path';
import si from 'systeminformation';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { DisposableAPIKey } from '../helper/disposable-api-key';
import { ActionErrorHintService } from './action-error-hint.service';
import { ArtifactService } from './artifact.service';
import { ContainerLifecycleService } from './container-lifecycle.service';
import { LogIngestionService } from './log-ingestion.service';

@Injectable()
export class ActionManagerService implements OnModuleInit {
    private currentInstanceId: string | undefined;
    private initPromise!: Promise<void>;

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        @InjectRepository(ActionRunnerEntity)
        private actionRunnerRepository: Repository<ActionRunnerEntity>,
        private accessControlService: AccessControlService,
        private readonly containerLifecycleService: ContainerLifecycleService,
        private readonly actionErrorHintService: ActionErrorHintService,
        private readonly logIngestionService: LogIngestionService,
        private readonly artifactService: ArtifactService,
    ) {}

    async onModuleInit(): Promise<void> {
        this.initPromise = this.registerRunner();
        await this.initPromise;
    }

    private async registerRunner(): Promise<void> {
        const osInfo = await si.osInfo();
        const hostname = osInfo.hostname;

        let packageJsonVersion = 'unknown';
        try {
            const packageJsonPath = path.resolve(
                __dirname,
                '../../../package.json',
            );
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, 'utf8'),
            ) as { version: string };
            packageJsonVersion = packageJson.version;
        } catch (error) {
            logger.warn(
                `Failed to read package.json version: ${String(error)}`,
            );
        }

        const gitHash = process.env.GIT_COMMIT ?? 'unknown';

        // Let DB generate UUID
        const runner = this.actionRunnerRepository.create({
            hostname,
            version: packageJsonVersion,
            gitHash,
            startedAt: new Date(),
            lastSeenAt: new Date(),
        });
        const savedRunner = await this.actionRunnerRepository.save(runner);
        this.currentInstanceId = savedRunner.uuid;
        logger.info(
            `Action Runner registered with ID: ${this.currentInstanceId}`,
        );
    }

    /**
     * Get the current runner instance ID.
     */
    getCurrentInstanceId(): string | undefined {
        return this.currentInstanceId;
    }

    /**
     * Update the heartbeat timestamp for the current runner.
     */
    async updateHeartbeat(): Promise<void> {
        await this.initPromise;
        if (!this.currentInstanceId) {
            return;
        }
        await this.actionRunnerRepository.update(
            { uuid: this.currentInstanceId },
            { lastSeenAt: new Date() },
        );
    }

    /**
     * Creates a new API key for the given action.
     * The API key is used to authenticate the action container.
     *
     * The API key is automatically deleted when the action is completed.
     *
     * @param action
     */
    @tracing('create_apikey')
    async createAPIkey(action: ActionEntity): Promise<DisposableAPIKey> {
        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }

        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }

        if (action.creator === undefined) {
            throw new Error('User is undefined');
        }

        const hasWriteAccess = await this.accessControlService.canAccessMission(
            {
                uuid: action.creator.uuid,
                role: action.creator.role ?? UserRole.USER,
            },
            action.mission,
            AccessGroupRights.WRITE,
        );
        if (!hasWriteAccess) {
            throw new Error(
                `User ${action.creator.uuid} lost access to mission ${action.mission.uuid}`,
            );
        }

        const apiKey = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            rights: action.template.accessRights,

            // eslint-disable-next-line @typescript-eslint/naming-convention
            key_type: KeyTypes.ACTION,
            action: action,
            user: action.creator,
        });
        return new DisposableAPIKey(
            await this.apikeyRepository.save(apiKey),
            this.apikeyRepository,
        );
    }

    @tracing('processing_action')
    async processAction(action: Readonly<ActionEntity>): Promise<boolean> {
        await this.initPromise;
        if (!this.currentInstanceId) {
            throw new Error(
                'ActionManagerService not initialized: currentInstanceId is missing',
            );
        }

        logger.info(`\n\nProcessing Action ${action.uuid}`);

        logger.info('Creating container.');

        if (action.state !== ActionState.PENDING) {
            logger.error(
                `Action ${action.uuid} state is '${action.state}' (expected 'PENDING'). Trigger source: ${action.triggerSource}`,
            );
            throw new Error(
                `Action state is not 'PENDING'. Current state: ${action.state}`,
            );
        }

        // set state to 'STARTING'
        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                state: ActionState.STARTING,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause: 'Action is currently running...',
            },
        );

        if (action.mission === undefined) {
            throw new Error('Mission is undefined');
        }
        if (action.template === undefined) {
            throw new Error('Template is undefined');
        }
        if (action.creator === undefined) {
            throw new Error('User is undefined');
        }
        if (action.mission.project === undefined) {
            throw new Error('Project is undefined');
        }

        const apikey = await this.createAPIkey(action);
        try {
            const {
                container,
                repoDigests,
                sha,
                source,
                localCreatedAt,
                remoteCreatedAt,
            } = await this.containerLifecycleService.startActionContainer(
                this.currentInstanceId,
                action,
                apikey.apikey,
                async () => {
                    await this.actionRepository.update(
                        { uuid: action.uuid },
                        { state: ActionState.PROCESSING },
                    );
                },
            );

            // capture runner information
            const actionImage: Image = {
                repoDigests: repoDigests,
                sha,
                source,
                localCreatedAt,
                remoteCreatedAt,
            };
            const { executionStartedAt, container: actionContainer } =
                await this.getContainerInfo(container);
            await this.actionRepository.update(
                { uuid: action.uuid },

                {
                    executionStartedAt,
                    actionContainerStartedAt: executionStartedAt,
                    container: actionContainer,
                    image: actionImage,
                },
            );

            // eslint-disable-next-line @typescript-eslint/naming-convention
            const sanitize = (string_: string): string => {
                return string_.replace(apikey.apikey, '***');
            };

            // Delegate log ingestion to LogIngestionService
            await this.logIngestionService.startIngestion(
                container.id,
                action.uuid,
                sanitize,
            );

            // wait for the container to stop
            await container.wait();

            // update action state based on container exit code
            action = await this.actionRepository.findOneOrFail({
                where: { uuid: action.uuid },
                relations: ['worker', 'template'],
            });

            await this.actionRepository.update(
                { uuid: action.uuid },
                { state: ActionState.STOPPING },
            );

            this.containerLifecycleService.removeContainer(container.id, true);
            await this.setActionState(container, action);

            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    executionEndedAt: new Date(),
                    actionContainerExitedAt: new Date(),
                },
            );

            if (action.template === undefined) {
                throw new Error('Template is undefined');
            }

            // Delegate artifact upload to ArtifactService
            await this.artifactService.uploadArtifacts(
                action.uuid,
                this.currentInstanceId,
            );

            return true; // Mark the job as completed
        } catch (error: unknown) {
            logger.error(`Failed to process action: ${String(error)}`);
            await this.actionRepository.update(
                { uuid: action.uuid },
                {
                    state: ActionState.FAILED,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    state_cause:
                        error instanceof Error ? error.message : String(error),
                },
            );
            // Trigger hint assessment asynchronously
            void this.actionErrorHintService.assess(action.uuid);
            throw error;
        } finally {
            await apikey[Symbol.asyncDispose]();
        }
    }

    /**
     * Inspects the container and sets the container information to the action
     * object. This function does not save the action to the database!
     *
     * @param container
     * @private
     */
    private async getContainerInfo(container: Dockerode.Container): Promise<{
        executionStartedAt: Date;
        container: { id: string };
    }> {
        const containerId = container.id;
        const containerDetails = await container.inspect();

        return {
            executionStartedAt: new Date(containerDetails.Created),
            container: { id: containerId },
        };
    }

    /**
     * Sets the state of the action based on the container exit code.
     */
    private async setActionState(
        container: Dockerode.Container,
        action: Readonly<ActionEntity>,
    ): Promise<void> {
        const containerDetailsAfter = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${containerDetailsAfter.State.ExitCode.toString()}`,
        );

        const exitCode = containerDetailsAfter.State.ExitCode;

        let state: ActionState;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let exit_code: number;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        let state_cause: string;

        switch (exitCode) {
            case 125: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container failed to run. Docker run command failed.';
                break;
            }
            case 126: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause = 'Command cannot be invoked (Permission denied?).';
                break;
            }
            case 127: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause = 'Command not found.';
                break;
            }
            case 139: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container crashed (SIGSEGV). Invalid memory access.';
                break;
            }
            case 143: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container stopped (SIGTERM). Time limit approached.';
                break;
            }
            case 137: {
                state = ActionState.FAILED;
                exit_code = exitCode;
                state_cause =
                    'Container killed (SIGKILL). Exceeded memory or CPU limit.';
                break;
            }
            default: {
                state_cause = `Container exited with code ${exitCode.toString()}`;
                state = exitCode === 0 ? ActionState.DONE : ActionState.FAILED;
                exit_code = exitCode;
            }
        }
        logger.info(`Action ${action.uuid} finished with state ${state}`);

        await this.actionRepository.update(
            { uuid: action.uuid },
            {
                state,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                exit_code,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause,
            },
        );
    }
}
