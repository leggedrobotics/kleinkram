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
import Action, { SubmittedAction } from '@common/entities/action/action.entity';
import { RuntimeCapability, RuntimeRequirements } from '@common/types';
import { ActionManagerService } from './services/actionManager.service';
import { HardwareDependencyError } from './helper/hardwareDependencyError';
import { RuntimeCapabilitiesService } from './services/runtime-capabilities.service';

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
 * as the ActionController which is used to process the jobs is not designed
 * connects to the local Docker daemon, it is recommended to run only one
 * instance of the processor per machine.
 *
 */
@Processor('action-queue')
@Injectable()
export class ActionQueueProcessorProvider implements OnModuleInit {
    private runtime_capabilities: RuntimeCapability = undefined;

    constructor(
        @InjectQueue('action-queue')
        private readonly analysisQueue: Queue,
        @InjectRepository(Action)
        private actionRepository: Repository<Action>,
        private actionController: ActionManagerService,
        private runtimeCapabilitiesService: RuntimeCapabilitiesService,
    ) {}

    async onModuleInit() {
        logger.debug('Setting hardware capabilities...');
        this.runtime_capabilities =
            this.runtimeCapabilitiesService.getRuntimeCapabilities();

        logger.debug('Connecting to Redis...');
        await this.analysisQueue.isReady().catch((error) => {
            logger.error('Failed to connect to Redis:', error);
            throw error;
        });
    }

    /**
     *
     * Check if the job has any runtime requirements that are not met
     * by the current processing environment. If so, throw a
     * HardwareDependencyError is thrown.
     *
     * @private
     * @param runtime_requirements
     * @throws HardwareDependencyError
     *
     */
    private checkRuntimeCapability(runtime_requirements: RuntimeRequirements) {
        if (
            !!runtime_requirements.gpu_model &&
            !this.runtime_capabilities.gpu_model
        ) {
            throw new HardwareDependencyError(
                runtime_requirements,
                this.runtime_capabilities,
            );
        }
    }

    @Process({ concurrency: 5, name: 'actionProcessQueue' })
    async process_action(job: Job<{ uuid: string }>) {
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.data.uuid },
            relations: ['template', 'mission', 'mission.project', 'createdBy'],
        });
        this.checkRuntimeCapability(action.template.runtime_requirements);
        return await this.actionController.processAction(action);
    }

    @OnQueueActive()
    onActive(job: Job<SubmittedAction>) {
        logger.debug(`Processing job ${job.id} of type ${job.name}.`);
    }

    @OnQueueCompleted()
    async onCompleted(job: Job<SubmittedAction>) {
        logger.debug(`Job ${job.id} of type ${job.name} completed.`);
        await this.markJobAsCompleted(job);
    }

    @OnQueueFailed()
    async onFailed(job: Job<SubmittedAction>, error: any) {
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
    ) {
        const hasAttemptLeft = job.attemptsMade < job.opts.attempts;
        if (!hasAttemptLeft) {
            await this.handleUnexpectedError(job, error);
            return;
        }

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
    ) {
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

    /**
     * Mark the job as completed in the database.
     *
     * @param job The job that was completed
     * @private
     */
    private async markJobAsCompleted(job: Job<SubmittedAction>) {
        // update the state of the action in the database
        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: job.id as string },
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
}
