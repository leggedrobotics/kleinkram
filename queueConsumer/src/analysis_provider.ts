import Docker from "dockerode";
import logger from "./logger";
import {Injectable, OnModuleInit} from "@nestjs/common";
import {InjectQueue, OnQueueActive, Process, Processor} from "@nestjs/bull";
import {Job, Queue} from "bull";
import {traceWrapper} from "./tracing";


@Processor('analysis-queue')
@Injectable()
export class AnalysisProcessor implements OnModuleInit {

    constructor(
        @InjectQueue('analysis-queue') private readonly analysisQueue: Queue,
    ) {
        logger.debug('AnalysisProcessor created');
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

    // TODO: instead of concurrency we should use a more sophisticated way to limit the number of containers
    //  running at the same time by considering the resources available on the machine and the
    //  resources required by the containers (e.g., memory, CPU, disk space)
    @Process({concurrency: 1, name: 'processAnalysisFile'})
    async handleAnalysisRun(job: Job<{ queueUuid: string }>) {

        console.log('Analysis run started!');

        return await traceWrapper(async () => {

            // TODO: remove this listing
            const docker = new Docker({socketPath: '/var/run/docker.sock'});
            docker.listContainers((err, containers) => {
                if (err) {
                    logger.info('Failed to list containers');
                    logger.info(err);
                    return;
                }
                logger.info('Running containers:');
                containers.forEach((containerInfo) => {
                    logger.info(`Container: ${containerInfo.Id}`);
                });
            });

            // start a test container using dockerode
            // we constrain the disk to 10GB, the memory to 1GB, and the CPU to 1 core
            // TODO: replace with run analysis ID
            const uuid = Math.floor(Math.random() * 1000000);

            const container = await docker.createContainer({
                Image: 'ubuntu',
                name: 'datasets-runner-' + uuid,
                Cmd: ['/bin/sh', '-c', 'while true; do echo hello world; sleep 1; done'],
                HostConfig: {
                    Memory: 1073741824, // memory limit in bytes
                    NanoCpus: 1000000000, // CPU limit in nano CPUs
                    DiskQuota: 10737418240
                }
            });

            logger.info('Container created');
            await container.start();
            logger.info('Container started');

            // stop the container after 10 seconds
            await new Promise<void>((resolve) => {
                setTimeout(async () => {
                    await container.stop();
                    logger.info('Container stopped');

                    // kill the container
                    await container.remove();
                    logger.info('Container removed');

                    // TODO: save results in DB

                    resolve();
                }, 10_000);

            });


        }, 'processMinioFile')();

    }

}


