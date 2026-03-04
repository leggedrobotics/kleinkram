import { redis } from '@backend-common/consts';
import { ActionTemplateEntity } from '@backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@backend-common/entities/action/action.entity';
import { MissionEntity } from '@backend-common/entities/mission/mission.entity';
import { UserEntity } from '@backend-common/entities/user/user.entity';
import { WorkerEntity } from '@backend-common/entities/worker/worker.entity';
import { addActionQueue } from '@backend-common/scheduling-logic';
import { ActionState, ActionTriggerSource, UserRole } from '@kleinkram/shared';
import {
    ConflictException,
    Injectable,
    Logger,
    OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import Queue from 'bull';
import { Gauge } from 'prom-client';
import { EntityManager, LessThan, Repository } from 'typeorm';
import { AccessControlService } from '../access-control/access-control.service';

@Injectable()
export class ActionDispatcherService implements OnModuleInit {
    private readonly logger = new Logger(ActionDispatcherService.name);
    private actionQueues: Record<string, Queue.Queue> = {};

    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
        @InjectRepository(WorkerEntity)
        private workerRepository: Repository<WorkerEntity>,
        @InjectMetric('backend_online_workers')
        private onlineWorkers: Gauge,
        @InjectMetric('backend_pending_jobs')
        private pendingJobs: Gauge,
        @InjectMetric('backend_active_jobs')
        private activeJobs: Gauge,
        @InjectMetric('backend_completed_jobs')
        private completedJobs: Gauge,
        @InjectMetric('backend_failed_jobs')
        private failedJobs: Gauge,
        private accessControlService: AccessControlService,
    ) {}

    async onModuleInit(): Promise<void> {
        const availableWorkers = await this.workerRepository.find({
            where: { reachable: true },
        });

        this.actionQueues = {};

        // Initialize queues for all reachable workers
        try {
            await Promise.all(
                availableWorkers.map(async (worker) => {
                    this.actionQueues[worker.identifier] = new Queue(
                        `action-queue-${worker.identifier}`,
                        { redis },
                    );
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    await this.actionQueues[worker.identifier]?.isReady();
                }),
            );
            this.logger.log('Action Queues initialized');
        } catch (error) {
            this.logger.error('Failed to initialize action queues', error);
        }

        // Update metrics immediately
        this.onlineWorkers.set({}, availableWorkers.length);
    }

    /**
     * Core dispatch logic: Creates entity and schedules on Bull queue
     */
    async dispatch(
        templateUuid: string,
        mission: MissionEntity,
        creator: UserEntity,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        parameters: Record<string, any>,
        triggerSource: ActionTriggerSource = ActionTriggerSource.MANUAL,
        triggerUuid?: string,
    ): Promise<string> {
        const template = await this.actionTemplateRepository.findOneOrFail({
            where: { uuid: templateUuid },
        });

        const canAccess = await this.accessControlService.canAccessMission(
            {
                uuid: creator.uuid,
                role: creator.role ?? UserRole.USER,
            },
            mission,
            template.accessRights,
        );

        if (!canAccess) {
            this.logger.error(
                `[Dispatch] Access denied for user ${creator.uuid}`,
            );
            throw new ConflictException(
                'Creator no longer has access to this mission',
            );
        }

        try {
            const lokiUrl = process.env.LOKI_URL ?? 'http://loki:3100';
            const { default: axios } = await import('axios');
            await axios.get(`${lokiUrl}/ready`, { timeout: 2000 });
        } catch {
            this.logger.error('Loki logging system is down or unreachable');
            throw new ConflictException(
                'Logging system (Loki) is not available. Please try again later.',
            );
        }

        let action = this.actionRepository.create({
            mission,
            creator,
            state: ActionState.PENDING,
            template,
            triggerSource,
            triggerUuid,
        });

        action = await this.actionRepository.save(action);

        try {
            const runtimeRequirements = {
                cpuCores: template.cpuCores,
                cpuMemory: template.cpuMemory,
                gpuMemory: template.gpuMemory,
                maxRuntime: template.maxRuntime,
                ...parameters,
            };

            // Try to queue
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            let queued = await addActionQueue(
                action,
                runtimeRequirements,
                this.workerRepository,
                this.actionRepository,
                this.actionQueues,
                this.logger,
            );

            // If failed, try to refresh workers and retry
            if (!queued) {
                this.logger.warn(
                    'Queue rejection, attempting to refresh workers and retry...',
                );
                await this.healthCheck();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                queued = await addActionQueue(
                    action,
                    runtimeRequirements,
                    this.workerRepository,
                    this.actionRepository,
                    this.actionQueues,
                    this.logger,
                );
            }

            if (!queued) throw new Error('Queue rejection');

            this.logger.log(
                `Action ${action.uuid} dispatched for mission ${mission.uuid}`,
            );
            return action.uuid;
        } catch (error) {
            this.logger.error(`Failed to queue action ${action.uuid}`, error);
            await this.actionRepository.update(action.uuid, {
                state: ActionState.UNPROCESSABLE,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause: 'Resources unavailable or queue error',
            });
            throw new ConflictException('No worker available');
        }
    }

    /**
     * Stops a running action by removing it from the specific worker queue
     */
    async stopAction(actionRunId: string): Promise<void> {
        let actionIdentifier: string | undefined = undefined;

        await this.actionRepository.manager.transaction(
            async (manager: EntityManager): Promise<void> => {
                const action = await manager.findOne(ActionEntity, {
                    where: { uuid: actionRunId },
                    relations: ['worker'],
                });

                if (action?.worker === undefined)
                    throw new Error('No worker found for this action');

                action.state = ActionState.FAILED;
                await manager.save(action);
                actionIdentifier = action.worker.identifier;
            },
        );

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (actionIdentifier === undefined)
            throw new ConflictException('Action or Worker not found');

        const queue = this.actionQueues[actionIdentifier];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!queue) throw new ConflictException('Worker queue not active');

        const job = await queue.getJob(actionRunId);
        if (!job) {
            this.logger.warn(`Job ${actionRunId} not found in queue to stop`);
            return;
        }

        await job.remove();
        this.logger.log(`Action ${actionRunId} stopped successfully`);
    }

    /**
     * Checks for unreachable workers and re-queues their pending jobs
     */
    @Cron(CronExpression.EVERY_30_SECONDS)
    async healthCheck() {
        // Find workers that have timed out
        const workers = await this.workerRepository.find({
            where: {
                reachable: true,
                lastSeen: LessThan(new Date(Date.now() - 2 * 60 * 1000)),
            },
        });

        await Promise.all(
            workers.map(async (worker) => {
                this.logger.warn(`${worker.identifier} is now unreachable`);
                worker.reachable = false;
                await this.workerRepository.save(worker);

                const actionQueue = this.actionQueues[worker.identifier];
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                if (!actionQueue) return;

                try {
                    // Retrieve jobs that were assigned to this dead worker
                    const waitingJobs = await actionQueue.getJobs([
                        'active',
                        'delayed',
                        'waiting',
                    ]);

                    await Promise.all(
                        waitingJobs.map(async (job) => {
                            try {
                                const action =
                                    await this.actionRepository.findOneOrFail({
                                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                                        where: { uuid: job.data.uuid },
                                        relations: ['template'],
                                    });

                                await job.remove();

                                // Re-schedule logic
                                const runtimeRequirements = {
                                    cpuCores: action.template?.cpuCores ?? 1,
                                    cpuMemory:
                                        action.template?.cpuMemory ?? 512,
                                    gpuMemory: action.template?.gpuMemory ?? -1,
                                    maxRuntime:
                                        action.template?.maxRuntime ?? 4,
                                };

                                this.logger.log(
                                    `Re-queueing action ${action.uuid} from dead worker`,
                                );

                                //
                                await addActionQueue(
                                    action,
                                    runtimeRequirements,
                                    this.workerRepository,
                                    this.actionRepository,
                                    this.actionQueues,
                                    this.logger,
                                );
                            } catch (error) {
                                this.logger.error(
                                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                                    `Failed to re-queue job ${job.id}`,
                                    error,
                                );
                            }
                        }),
                    );

                    // Clean up the local queue reference
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete this.actionQueues[worker.identifier];
                } catch (error) {
                    this.logger.error(
                        `Error handling dead worker ${worker.identifier}`,
                        error,
                    );
                }
            }),
        );

        // Re-initialize queues for reachable workers (in case new ones appeared)
        const activeWorker = await this.workerRepository.find({
            where: { reachable: true },
        });

        for (const worker of activeWorker) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!this.actionQueues[worker.identifier]) {
                this.actionQueues[worker.identifier] = new Queue(
                    `action-queue-${worker.identifier}`,
                    { redis },
                );
            }
        }

        this.onlineWorkers.set({}, activeWorker.length);
    }

    /**
     * Updates Prometheus metrics for Action Queues
     */
    @Cron(CronExpression.EVERY_SECOND)
    async checkQueueState(): Promise<void> {
        const queues = Object.values(this.actionQueues);

        const jobCounts = await Promise.all(
            queues.map((q) => q.getJobCounts()),
        );

        for (const [index, count] of jobCounts.entries()) {
            const queueName = queues[index]?.name;
            this.pendingJobs.set(
                { queue: queueName },
                count.waiting + count.delayed,
            );
            this.activeJobs.set({ queue: queueName }, count.active);
            this.completedJobs.set({ queue: queueName }, count.completed);
            this.failedJobs.set({ queue: queueName }, count.failed);
        }
    }

    // Helper to inspect queues (used by API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getAllJobs(): Promise<any[]> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jobs: any[] = [];

        for (const queue of Object.values(this.actionQueues)) {
            const _jobs = await queue.getJobs([
                'active',
                'delayed',
                'waiting',
                'completed',
                'failed',
            ]);
            jobs.push(..._jobs);
        }
        return jobs;
    }
}
