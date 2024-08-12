import logger from '../logger';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    InjectQueue,
    OnQueueActive,
    OnQueueCompleted,
    OnQueueFailed,
    Process,
    Processor,
} from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { tracing } from '../tracing';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionState, KeyTypes } from '@common/enum';
import Action from '@common/entities/action/action.entity';
import {
    ContainerEnv,
    ContainerScheduler,
    dockerDaemonErrorHandler,
} from './container_scheduler';
import Apikey from '@common/entities/auth/apikey.entity';
import * as os from 'node:os';

@Processor('action-queue')
@Injectable()
export class ActionQueueProcessor
    extends ContainerScheduler
    implements OnModuleInit
{
    constructor(
        @InjectQueue('action-queue') private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        actionRepository: Repository<Action>,
        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
    ) {
        super(actionRepository);
        logger.debug('AnalysisProcessor constructor');
    }

    async onModuleInit() {
        logger.debug('Connecting to Redis...');
        try {
            await this.analysisQueue.isReady();
            logger.debug('Connected to Redis successfully!');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
        }

        await super.onModuleInit();
    }

    // TODO: instead of concurrency we should use a more sophisticated way to limit the number of containers
    //  running at the same time by considering the resources available on the machine and the
    //  resources required by the containers (e.g., memory, CPU, disk space)
    @Process({ concurrency: 5, name: 'actionProcessQueue' })
    async process_action(job: Job<{ mission_action_id: string }>) {
        return await this.handleAction(job);
    }

    @OnQueueActive()
    onActive(job: Job) {
        logger.debug(`Processing job ${job.id} of type ${job.name}.`);
    }

    @OnQueueCompleted()
    async onCompleted(job: Job) {
        logger.debug(`Job ${job.id} of type ${job.name} completed.`);

        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.data.mission_action_id },
        });

        // set state to done if it is not already set to failed
        if (action.state !== ActionState.FAILED) {
            action.state = ActionState.DONE;
            await this.actionRepository.save(action);
        }
    }

    @OnQueueFailed()
    async onFailed(job: Job, error: any) {
        logger.error(
            `Job ${job.id} of type ${job.name} failed with error: ${error.message}.`,
        );
        logger.error(error.stack);
        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.data.mission_action_id },
        });
        action.state = ActionState.FAILED;
        action.state_cause = error.message;
        await this.actionRepository.save(action);
    }

    @tracing('processing_action')
    private async handleAction(job: Job<{ mission_action_id: string }>) {
        logger.info(`\n\nProcessing Action ${job.data.mission_action_id}`);

        logger.info('Creating container.');
        const uuid = job.data.mission_action_id;
        const action = await this.actionRepository.findOne({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (!action.uuid || action.uuid !== uuid)
            throw new Error('Action not found');

        if (action.state !== ActionState.PENDING)
            throw new Error(`Action state is not 'PENDING'`);

        // set state to 'RUNNING'
        action.state = ActionState.PROCESSING;
        await this.actionRepository.save(action);

        const newAPIkey = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            apikeytype: KeyTypes.CONTAINER,
        });
        const apikey = await this.apikeyRepository.save(newAPIkey);

        const env_variables: ContainerEnv = {
            APIKEY: apikey.apikey,
            PROJECT_UUID: action.mission.project.uuid,
            MISSION_UUID: action.mission.uuid,
            ACTION_UUID: action.uuid,
        };

        const container = await this.start_container({
            docker_image: action.docker_image,
            uuid,
            limits: { max_runtime: 60 * 60 * 1_000 }, // 1 hour
            environment: env_variables,
        });

        // save start parameters to action object
        const container_id = container.id;

        const container_details = await container
            .inspect()
            .catch(dockerDaemonErrorHandler);
        const image_sha = container_details?.Image;

        // capture runner information
        const CPU_model = os.cpus()[0].model;
        const hostname = container_details?.Config?.Hostname;

        // update the action with additional information
        action.executionStartedAt = new Date(container_details.Created);
        action.container_id = container_id;
        action.docker_image_sha = image_sha;
        action.runner_hostname = hostname;
        action.runner_cpu_model = CPU_model;
        await this.actionRepository.save(action);

        const sanitize = (str: string) => {
            return str.replace(apikey.apikey, '***');
        };

        // get logs from container
        logger.info('Getting logs from container...');
        action.logs = await this.getContainerLogs(container, action, sanitize);
        await this.actionRepository.save(action);

        // wait for the container to stop
        await container.wait();
        const container_details_after = await container.inspect();

        logger.info(
            `Container ${container.id} exited with code ${container_details_after.State.ExitCode}`,
        );

        const exit_code = Number(container_details_after.State.ExitCode);
        action.state_cause = `Container exited with code ${exit_code}`;
        action.state = exit_code == 0 ? ActionState.DONE : ActionState.FAILED;
        action.exit_code = exit_code;
        await this.actionRepository.save(action);

        // expire the apikey
        // TODO: check if that really invalidates the token!!!
        apikey.deletedAt = new Date();
        await this.apikeyRepository.save(apikey);

        return true; // mark the job as completed
    }
}
