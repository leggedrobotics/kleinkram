import Action, { SubmittedAction } from '@common/entities/action/action.entity';
import Worker from '@common/entities/worker/worker.entity';
import { ActionState, ArtifactState } from '@common/frontend_shared/enum';
import {
    InjectQueue,
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
    Process,
    Processor,
} from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Job, Queue } from 'bull';
import os from 'node:os';
import { Repository } from 'typeorm';
import logger from '../logger';
import { HardwareDependencyError } from './helper/hardware-dependency-error';
import { createWorker, getDiskSpace } from './helper/hardware-detect';
import { ActionManagerService } from './services/action-manager.service';

/**
 * The ActionQueueProcessor class is responsible for processing
 * actions that are submitted to the action-queue. It listens for
 * new jobs in the queue and processes them using the ActionController.
 *
 * The processor checks the runtime requirements of the job and
 * reschedules the job if the current processing environment does
 * not meet the requirements.
 *
 * The ActionQueueProcessor designed to run in a distributed environment,
 * where multiple instances of the processor can run concurrently. However,
 * as the ActionController which is used to process the jobs
 * connects to the local Docker daemon, it is recommended to run only one
 * instance of the processor per machine.
 *
 */
@Processor(`action-queue-${os.hostname()}`)
@Injectable()
export class ActionQueueProcessorProvider implements OnModuleInit {
    private worker: Worker | undefined;

    constructor(
        @InjectQueue(`action-queue-${os.hostname()}`)
        private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        private actionController: ActionManagerService,
        @InjectRepository(Worker)
        private workerRepository: Repository<Worker>,
    ) {}

    async onModuleInit(): Promise<void> {
        logger.debug('Setting hardware capabilities...');

        const potentialWorker = await createWorker(this.workerRepository);

        let worker = await this.workerRepository.findOne({
            where: { hostname: potentialWorker.hostname },
        });
        if (worker) {
            worker.reachable = true;
            worker.lastSeen = new Date();
            worker.identifier = potentialWorker.identifier;
            worker = await this.workerRepository.save(worker);
        } else {
            worker = await this.workerRepository.save(potentialWorker);
        }
        this.worker = worker;
        logger.debug('Connecting to Redis...');
        await this.analysisQueue.isReady().catch((error: unknown) => {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        });
        logger.debug(`Status: ${this.analysisQueue.client.status}`);
    }

    @Process({ concurrency: 1, name: `action` })
    async processAction(job: Job<{ uuid: string }>): Promise<boolean> {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.data.uuid },
            relations: [
                'template',
                'mission',
                'mission.project',
                'createdBy',
                'worker',
            ],
        });

        if (this.worker === undefined || action.worker === undefined) {
            logger.error('Worker not found');
            throw new Error('Worker not found');
        }
        if (this.worker.uuid !== action.worker.uuid) {
            await this.actionRepository
                .createQueryBuilder()
                .update()
                .set({ worker: this.worker })
                .where('uuid = :uuid', { uuid: action.uuid })
                .execute();
            logger.warn(
                `Action ${action.uuid} reassigned to worker ${this.worker.identifier}`,
            );
        }
        return await this.actionController.processAction(action);
    }

    @OnQueueActive()
    onActive(job: Job<SubmittedAction>): void {
        logger.debug(
            `Processing job ${job.id.toString()} of type ${job.name}.`,
        );
    }

    @OnQueueCompleted()
    async onCompleted(job: Job<SubmittedAction>): Promise<void> {
        logger.debug(`Job ${job.id.toString()} of type ${job.name} completed.`);
        await this.markJobAsCompleted(job);
    }

    @OnQueueFailed()
    async onFailed(job: Job<SubmittedAction>, error: any): Promise<void> {
        logger.error(
            `Error processing job ${job.id.toString()} of type ${job.name}. Error handled by ${os.hostname()}`,
        );
        if (error instanceof HardwareDependencyError) {
            await this.handleHardwareDependencyError(job, error);
            return;
        }

        await this.handleUnexpectedError(job, error);
    }

    /**
     * Handle errors that occur when the job has unmet hardware dependencies.
     *
     * If the job has attempts left, the job is retried. Otherwise, the job is
     * removed from the queue and the action is marked as failed.
     *
     * @param job The job that failed
     * @param error The HardwareDependencyError that caused the job to fail
     * @private
     */
    private async handleHardwareDependencyError(
        job: Job<SubmittedAction>,
        error: HardwareDependencyError,
    ): Promise<void> {
        const hasAttemptLeft = job.attemptsMade < (job.opts.attempts ?? 0);
        if (!hasAttemptLeft) {
            await this.handleUnexpectedError(job, error);
            return;
        }

        // retry the job
        logger.debug(
            `Retrying job ${job.id.toString()} of type ${job.name} (attempt ${job.attemptsMade.toString()} of ${job.opts.attempts?.toString() ?? '0'}).\n`,
        );

        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.id as string },
        });
        action.state = ActionState.PENDING;
        action.state_cause = `Pending... ${error.message}`;
        await this.actionRepository.save(action);
    }

    /**
     * Handle unexpected errors that occur during the processing of the job.
     * This includes errors that are not related to hardware dependencies,
     * such as errors connecting to the Docker daemon, etc.
     *
     * @param job The job that failed
     * @param error The error that caused the job to fail
     * @private
     */
    private async handleUnexpectedError(
        job: Job<SubmittedAction>,
        error: Error,
    ): Promise<void> {
        // unmet hardware requirements or other error
        // remove the job from the queue and don't retry
        await job.remove();

        logger.error(
            `Job ${job.id.toString()} of type ${job.name} failed with error: ${error.message}.`,
        );
        logger.error(error.stack);
        try {
            // update the state of the action in the database
            const action = await this.actionRepository.findOneOrFail({
                where: { uuid: job.id as string },
            });

            action.state = ActionState.FAILED;
            action.state_cause = error.message;
            action.artifacts = ArtifactState.ERROR;
            await this.actionRepository.save(action);
        } catch (error_: unknown) {
            logger.error(
                `Failed to update action state in database: ${(error_ as { message: string }).message}`,
            );
        }
    }

    /**
     * Mark the job as completed in the database.
     *
     * @param job The job that was completed
     * @private
     */
    private async markJobAsCompleted(job: Job<SubmittedAction>): Promise<void> {
        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.id as string },
        });

        // set state to done if it is not already set to failed
        let isActionDirty = false;
        if (action.executionEndedAt) {
            action.executionEndedAt = new Date();
            isActionDirty = true;
        }
        if (action.state !== ActionState.FAILED) {
            action.state = ActionState.DONE;
            isActionDirty = true;
        }
        if (isActionDirty) {
            await this.actionRepository.save(action);
        }
    }

    @Cron(CronExpression.EVERY_MINUTE)
    async healthCheck(): Promise<void> {
        return this.workerRepository.manager.transaction(async (manager) => {
            if (this.worker === undefined) {
                logger.error('Worker not found');
                throw new Error('Worker not found');
            }

            const worker = await manager.findOneOrFail(Worker, {
                where: { uuid: this.worker.uuid },
            });
            worker.lastSeen = new Date();
            worker.reachable = true;
            worker.storage = await getDiskSpace();
            this.worker = await manager.save(worker);
        });
    }
}
