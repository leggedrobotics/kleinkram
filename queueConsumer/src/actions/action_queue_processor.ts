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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionState } from '@common/enum';
import Action from '@common/entities/action/action.entity';
import { ActionSubmissionDetails, RuntimeCapability } from '@common/types';
import { ContainerScheduler } from './container_scheduler';
import { HardwareDependencyError } from './helper/hardwareDependencyError';

@Processor('action-queue')
@Injectable()
export class ActionQueueProcessor implements OnModuleInit {
    private hardware_capabilities: RuntimeCapability = undefined;

    constructor(
        @InjectQueue('action-queue')
        private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        private containerScheduler: ContainerScheduler,
    ) {
        logger.debug('AnalysisProcessor constructor');
    }

    private async setHardwareCapabilities() {
        this.hardware_capabilities = {
            gpu_model: null, // TODO: get GPU capabilities from the system
        };
    }

    async onModuleInit() {
        logger.debug('AnalysisProcessor onModuleInit');

        logger.debug('Setting hardware capabilities...');
        await this.setHardwareCapabilities();

        try {
            logger.debug('Connecting to Redis...');
            await this.analysisQueue.isReady();
            logger.debug('Connected to Redis successfully!');
        } catch (error) {
            logger.error('Failed to connect to Redis:', error);
        }
    }

    private async checkHardwareConfiguration(
        job: Job<ActionSubmissionDetails>,
    ) {
        if (
            !!job.data.runtime_requirements.gpu_model &&
            !this.hardware_capabilities.gpu_model
        ) {
            throw new HardwareDependencyError(
                job.data.runtime_requirements,
                this.hardware_capabilities,
            );
        }
    }

    @Process({ concurrency: 5, name: 'actionProcessQueue' })
    async process_action(job: Job<ActionSubmissionDetails>) {
        await this.checkHardwareConfiguration(job);
        return await this.containerScheduler.handleAction(job.data);
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
        let isActionDirty = false;
        if (!!action.executionEndedAt) {
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

    @OnQueueFailed()
    async onFailed(job: Job, error: any) {
        const isHardwareDependencyError =
            error instanceof HardwareDependencyError;
        const hasAttemptLeft = job.attemptsMade < job.opts.attempts;

        if (isHardwareDependencyError && hasAttemptLeft) {
            // retry the job
            logger.debug(
                `Retrying job ${job.id} of type ${job.name} (attempt ${job.attemptsMade} of ${job.opts.attempts}).\n`,
            );

            // update the state of the action in the database
            const action = await this.actionRepository.findOneOrFail({
                where: { uuid: job.id as string },
            });
            action.state = ActionState.PENDING;
            action.state_cause = 'Pending... ' + error.message;
            await this.actionRepository.save(action);

            return;
        }

        // unmet hardware requirements or other error
        // remove the job from the queue and don't retry
        await job.remove();

        logger.error(
            `Job ${job.id} of type ${job.name} failed with error: ${error.message}.`,
        );
        logger.error(error.stack);
        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.id as string },
        });
        action.state = ActionState.FAILED;
        action.state_cause = error.message;
        await this.actionRepository.save(action);
    }
}
