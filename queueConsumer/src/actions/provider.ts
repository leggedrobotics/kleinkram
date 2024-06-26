import logger from '../logger';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue, OnQueueActive, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { tracing } from '../tracing';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionState } from '@common/enum';
import Action from '@common/entities/action/action.entity';
import { ContainerScheduler } from './container_scheduler';


@Processor('action-queue')
@Injectable()
export class ActionQueueProcessor extends ContainerScheduler implements OnModuleInit {

    constructor(
        @InjectQueue('action-queue') private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
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

        // set state to 'RUNNING'
        action.state = ActionState.PROCESSING;
        await this.actionRepository.save(action);

        // TODO: remove this hardcoded image
        action.docker_image = 'ubuntu:latest';
        const container = await this.start_container(action.docker_image, uuid);

        // get logs from container
        logger.info('Getting logs from container:\n');
        action.logs = await this.getContainerLogs(container);
        await this.actionRepository.save(action);

        // wait for the container to stop
        await container.wait();
        logger.info('Container stopped');

        return true; // mark the job as completed

    }


}
