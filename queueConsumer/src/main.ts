// this input must be at the top of the file
import tracer from './tracing';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import logger from './logger';

import Docker from 'dockerode';

async function bootstrap() {

  // list running containers using dockerode
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
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

  // stop the container after 100 seconds
  setTimeout(async () => {
    await container.stop();
    logger.info('Container stopped');

    // kill the container
    await container.remove();
    logger.info('Container removed');

    // show the container logs
    const logs = await container.logs();
    logs.forEach((log) => {
      logger.info(log.toString());
    });


  }, 100000);


  tracer.start();
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);

  logger.info('Application started');

}

bootstrap().catch((err) => {
  logger.error('Failed to start application');
  logger.error(err);
});