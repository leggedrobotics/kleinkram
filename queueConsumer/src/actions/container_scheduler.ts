import { Injectable, OnModuleInit } from '@nestjs/common';
import {
    ContainerEnv,
    DockerDaemon,
    dockerDaemonErrorHandler,
} from './docker_daemon';
import { tracing } from '../tracing';
import { ActionSubmissionDetails } from '@common/types';
import logger from '../logger';
import { ActionState, KeyTypes } from '@common/enum';
import os from 'node:os';
import { InjectRepository } from '@nestjs/typeorm';
import Action from '@common/entities/action/action.entity';
import { Repository } from 'typeorm';
import Apikey from '@common/entities/auth/apikey.entity';

@Injectable()
export class ContainerScheduler implements OnModuleInit {
    constructor(
        private containerDaemon: DockerDaemon,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        @InjectRepository(Apikey)
        private apikeyRepository: Repository<Apikey>,
    ) {
        console.log('ContainerScheduler constructor');
    }

    async onModuleInit() {
        console.log('ContainerScheduler onModuleInit');
    }

    @tracing('processing_action')
    async handleAction(action_data: ActionSubmissionDetails) {
        logger.info(`\n\nProcessing Action ${action_data.action_uuid}`);

        logger.info('Creating container.');
        const uuid = action_data.action_uuid;
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

        const { container, image_repo_digests } =
            await this.containerDaemon.start_container({
                docker_image: action.image.name,
                uuid,
                limits: { max_runtime: 60 * 60 * 1_000 }, // 1 hour
                needs_gpu: action_data.runtime_requirements.gpu_model !== null,
                environment: env_variables,
            });

        // save start parameters to action object
        const container_id = container.id;
        const container_details = await container
            .inspect()
            .catch(dockerDaemonErrorHandler);

        // capture runner information
        const CPU_model = os.cpus()[0].model;
        const hostname = container_details?.Config?.Hostname;

        // update the action with additional information
        action.executionStartedAt = new Date(container_details.Created);
        action.container = {
            id: container_id,
        };
        action.image.repo_digests = image_repo_digests;
        action.runner_hostname = hostname;
        action.runner_cpu_model = CPU_model;
        await this.actionRepository.save(action);

        const sanitize = (str: string) => {
            return str.replace(apikey.apikey, '***');
        };

        // get logs from container
        logger.info('Getting logs from container...');
        action.logs = await this.containerDaemon.getContainerLogs(
            container,
            action,
            sanitize,
        );
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
        action.executionEndedAt = new Date();
        await this.actionRepository.save(action);

        // expire the apikey
        // TODO: check if that really invalidates the token!!!
        apikey.deletedAt = new Date();
        await this.apikeyRepository.save(apikey);

        return true; // mark the job as completed
    }
}
