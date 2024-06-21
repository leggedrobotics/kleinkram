import Docker from 'dockerode';
import logger from './logger';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue, OnQueueActive, Process, Processor } from '@nestjs/bull';
import { Job, Queue } from 'bull';
import { tracing } from './tracing';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Action, { ContainerLog } from './entities/action.entity';
import { ActionState } from './enum';

@Processor('action-queue')
@Injectable()
export class AnalysisProcessor implements OnModuleInit {
    private readonly docker: Docker;

    constructor(
        @InjectQueue('action-queue') private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
    ) {
        this.docker = new Docker({ socketPath: '/var/mission/docker.sock' });
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

    @OnQueueActive()
    onActive(job: Job) {
        logger.debug(`Processing job ${job.id} of type ${job.name}.`);
    }

    /**
     * Checks all pending missions, if no container is missionning, it updates the state of the mission to 'FAILED'.
     */
    @tracing()
    private async findCrashedContainers() {
        logger.debug('Checking pending missions');

        const actions = await this.actionRepository.find({
            where: { state: ActionState.PROCESSING },
            relations: ['action', 'mission.project'],
        });

        logger.info(`Checking ${actions.length} pending Actions.`);

        const docker = new Docker({ socketPath: '/var/mission/docker.sock' });
        const container_ids = await docker.listContainers({ all: true });
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

        const docker = new Docker({ socketPath: '/var/mission/docker.sock' });
        const container_ids = await docker.listContainers({ all: true });

        const now = new Date().getTime();
        const killTime = now - killAge * 60 * 1000;

        for (const container of container_ids) {
            const containerInfo = await docker
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
                await docker.getContainer(container.Id).kill();

                // set state in the database
                const uuid = containerName.split('-')[2];
                const action = await this.actionRepository.findOne({
                    where: { uuid: uuid },
                    relations: ['action', 'mission.project'],
                });

                action.state = ActionState.FAILED;
                action.state_cause = 'Container killed.';
                await this.actionRepository.save(action);
            }
        }
    }

    @tracing('processing_action')
    private async handleAction(job: Job<{ action_id: string }>) {
        logger.info(`\n\nProcessing Action ${job.data.action_id}`);

        // TODO: currently we allow only one container to mission at a time, we should change this to allow more
        //  containers to mission concurrently
        logger.info('Killing old containers and finding crashed containers');
        await this.killOldContainers(0);
        await this.findCrashedContainers();

        logger.info('Creating container.');
        const uuid = job.data.action_id;
        const action = await this.actionRepository.findOne({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        // set state to 'RUNNING'
        action.state = ActionState.PROCESSING;
        await this.actionRepository.save(action);

        // TODO: remove this hardcoded image
        action.docker_image = 'ubuntu:latest';
        await this.pull_image(action.docker_image);
        const container = await this.run_container(action, uuid);

        // get logs from container
        logger.info('Getting logs from container:\n');
        const logs = await this.getContainerLogs(container);
        logs.forEach((log) => {
            logger.info(`[${log.type}] @${log.timestamp}: ${log.message}`);
        });

        // save results in database
        action.state = ActionState.DONE;
        action.logs = logs;
        await this.actionRepository.save(action);

        // mark the job as completed
        return { success: true };
    }

    @tracing()
    private async run_container(action: Action, uuid: string) {
        logger.info('Creating container...');
        const container = await this.docker.createContainer({
            Image: action.docker_image,
            name: 'datasets-runner-' + uuid,
            Cmd: [
                '/bin/sh',
                '-c',
                'while true; do echo hello world; sleep 1; done',
            ],
            HostConfig: {
                Memory: 1073741824, // memory limit in bytes
                NanoCpus: 1000000000, // CPU limit in nano CPUs
                DiskQuota: 10737418240,
            },
        });

        logger.info('Container created! Starting container...');
        await container.start();
        logger.info(`Container started wit id: ${container.id}`);

        // stop the container after 10 seconds
        await new Promise<void>((resolve) => {
            setTimeout(async () => {
                await container.stop();
                logger.info('Container stopped');

                // wait for max 10 seconds for the container to stop, otherwise kill it
                setTimeout(async () => {
                    if ((await container.inspect()).State.Running) {
                        await container.kill();
                        logger.info('Container killed');
                    }

                    resolve();
                }, 10_000);
            }, 10_000);
        });
        return container;
    }

    @tracing()
    private async pull_image(docker_image: string) {
        logger.info(`Pulling image ${docker_image}`);
        const pullStream = await this.docker.pull(docker_image);
        await new Promise((res) =>
            this.docker.modem.followProgress(pullStream, res),
        );
        logger.info('Image pulled!');
    }

    /**
     * Get logs from running or stopped container and return the logs as an array of objects.
     * Each object contains the timestamp, message, and type of the log (stdout or stderr).
     *
     * @param container - The container to get logs from
     *
     */
    @tracing()
    private async getContainerLogs(
        container: Docker.Container,
    ): Promise<ContainerLog[]> {
        const logs: ContainerLog[] = [];

        return new Promise(async (resolve, reject) => {
            const stream = await container.logs({
                follow: true,
                stdout: true,
                stderr: true,
                timestamps: true,
            });

            stream.on('data', (chunk: Buffer) => {
                const logLines = chunk.toString().split('\n');
                logLines.forEach((line) => {
                    if (line.trim() !== '') {
                        const timestamp = line.split(' ')[0].split('+')[1];
                        const message = line.split(' ').slice(1).join(' ');

                        logs.push({
                            timestamp: timestamp,
                            message: message,
                            type: line.startsWith('[stderr]')
                                ? 'stderr'
                                : 'stdout',
                        });
                    }
                });
            });

            stream.on('end', () => {
                resolve(logs);
            });

            stream.on('error', (error) => {
                reject(error);
            });
        });
    }

    // TODO: instead of concurrency we should use a more sophisticated way to limit the number of containers
    //  running at the same time by considering the resources available on the machine and the
    //  resources required by the containers (e.g., memory, CPU, disk space)
    @Process({ concurrency: 1, name: 'processAnalysisFile' })
    async process_action(job: Job<{ action_id: string }>) {
        return await this.handleAction(job);
    }
}
