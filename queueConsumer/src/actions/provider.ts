import logger from '../logger';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue, OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { tracing } from '../tracing';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionState, KeyTypes } from '@common/enum';
import Action from '@common/entities/action/action.entity';
import { ContainerEnv, ContainerScheduler } from './container_scheduler';
import Apikey from '@common/entities/auth/apikey.entity';


@Processor('action-queue')
@Injectable()
export class ActionQueueProcessor extends ContainerScheduler implements OnModuleInit {

    constructor(
        @InjectQueue('action-queue') private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
    ) {
        super();
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
    }

    // TODO: instead of concurrency we should use a more sophisticated way to limit the number of containers
    //  running at the same time by considering the resources available on the machine and the
    //  resources required by the containers (e.g., memory, CPU, disk space)
    @Process({ concurrency: 1, name: 'actionProcessQueue' })
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
        action.state = ActionState.DONE;
        await this.actionRepository.save(action);

    }

    @OnQueueFailed()
    async onFailed(job: Job, error: any) {
        logger.error(`Job ${job.id} of type ${job.name} failed with error: ${error.message}.`);
        logger.error(error.stack);

        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.data.mission_action_id },
        });
        action.state = ActionState.FAILED;
        action.state_cause = error.message;
        await this.actionRepository.save(action);
    }

    /**
     * Checks all pending missions, if no container is running,
     * it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    private async setCrashedContainersToFailed() {
        logger.debug('Checking pending missions');

        const actions = await this.actionRepository.find({
            where: { state: ActionState.PROCESSING },
            relations: ['mission', 'mission.project'],
        });

        logger.info(`Checking ${actions.length} pending Actions.`);

        const container_ids = await this.docker.listContainers({ all: true });
        const running_containers = container_ids.map(
            (container) => container.Id,
        );

        for (const action of actions) {
            if (!running_containers.includes(action.docker_image)) {
                logger.info(
                    `Action ${action.uuid} is running but has no running container. Setting state to 'FAILED'.`,
                );
                action.state = ActionState.FAILED;
                action.state_cause = 'Container crashed';
                await this.actionRepository.save(action);
            }
        }
    }

    /**
     * Kills all containers (and tagged using this projects naming convention) that are older than i minutes.
     * If it is 0, all containers are killed.
     **
     * @param killAge - The age of the containers
     * @private
     */
    @tracing()
    private async killOldContainers(killAge: number = 0) {
        logger.info(`Killing containers older than ${killAge} minutes`);

        const container_ids = await this.docker.listContainers({ all: true });

        const now = new Date().getTime();
        const killTime = now - killAge * 60 * 1000;

        for (const container of container_ids) {
            const containerInfo = await this.docker
                .getContainer(container.Id)
                .inspect();
            const containerName = containerInfo.Name;
            const containerCreated = new Date(containerInfo.Created).getTime();

            if (
                containerName.startsWith('datasets-runner-') &&
                containerCreated < killTime
            ) {
                logger.info(
                    `Killing container ${containerName} created at ${containerCreated}`,
                );
                await this.docker.getContainer(container.Id).kill();

                // set state in the database
                const uuid = containerName.split('-')[2];
                const action = await this.actionRepository.findOne({
                    where: { uuid: uuid },
                    relations: ['mission', 'mission.project'],
                });

                action.state = ActionState.FAILED;
                action.state_cause = 'Container killed.';
                await this.actionRepository.save(action);
            }
        }
    }

    @tracing('processing_action')
    private async handleAction(job: Job<{ mission_action_id: string }>) {
        logger.info(`\n\nProcessing Action ${job.data.mission_action_id}`);

        // TODO: currently we allow only one container to mission at a time, we should change this to allow more
        //  containers to mission concurrently
        logger.info('Killing old containers and finding crashed containers');
        await this.killOldContainers(0);
        await this.setCrashedContainersToFailed();

        logger.info('Creating container.');
        const uuid = job.data.mission_action_id;
        const action = await this.actionRepository.findOne({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (!action.uuid || action.uuid !== uuid)
            throw new Error('Action not found');

        // set state to 'RUNNING'
        action.state = ActionState.PROCESSING;
        await this.actionRepository.save(action);

        const now = new Date();
        const newToken = this.apikeyRepository.create({
            mission: { uuid: action.mission.uuid },
            apikeytype: KeyTypes.CONTAINER,
            deletedAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
        });
        const apikey = await this.apikeyRepository.save(newToken);

        const env_variables: ContainerEnv = {
            APIKEY: apikey.apikey,
            PROJECT_UUID: action.mission.project.uuid,
            MISSION_UUID: action.mission.uuid,
            ACTION_UUID: action.uuid,
        };

        const container = await this.start_container({
            docker_image: action.docker_image,
            uuid,
            limits: { max_runtime: 10 * 1_000 }, // 10 seconds
            environment: env_variables,
        });

        const sanitize = (str: string) => {
            return str.replace(apikey.apikey, '***');
        };

        // get logs from container
        logger.info('Getting logs from container...');
        action.logs = await this.getContainerLogs(container, sanitize);
        await this.actionRepository.save(action);

        // wait for the container to stop
        await container.wait();
        logger.info('Container stopped');

        // expire the apikey
        // TODO: check if that really invalidates the token!!!
        apikey.deletedAt = new Date();
        await this.apikeyRepository.save(apikey);

        return true; // mark the job as completed

    }


}
