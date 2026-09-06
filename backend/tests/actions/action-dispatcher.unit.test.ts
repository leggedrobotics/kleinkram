import {
    AccessControlService,
    ActionEntity,
    ActionTemplateEntity,
    MissionEntity,
    UserEntity,
    WorkerEntity,
} from '@kleinkram/backend-common';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import * as schedulingLogic from '@kleinkram/backend-common/scheduling-logic';
import { ActionState, ActionTriggerSource, UserRole } from '@kleinkram/shared';
import { Gauge } from 'prom-client';
import { EntityManager, Repository } from 'typeorm';

// Mock scheduling logic
jest.mock('@kleinkram/backend-common/scheduling-logic', () => ({
    addActionQueue: jest.fn(),
}));

// Mock axios for Loki health check
jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ status: 200 }),
}));

// Mock ioredis
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => {
        return {
            publish: jest.fn().mockResolvedValue(1),
            quit: jest.fn().mockResolvedValue('OK'),
        };
    });
});

describe('ActionDispatcherService Unit Tests', () => {
    let service: ActionDispatcherService;
    let actionRepo: Repository<ActionEntity>;
    let templateRepo: Repository<ActionTemplateEntity>;
    let workerRepo: Repository<WorkerEntity>;
    let accessControlService: AccessControlService;
    let gauge: Gauge;

    beforeEach(() => {
        actionRepo = {
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            manager: {
                transaction: jest.fn(),
            } as unknown as EntityManager,
        } as unknown as Repository<ActionEntity>;

        templateRepo = {
            findOneOrFail: jest.fn(),
        } as unknown as Repository<ActionTemplateEntity>;

        workerRepo = {
            find: jest.fn(),
        } as unknown as Repository<WorkerEntity>;

        accessControlService = {
            canAccessMission: jest.fn(),
        } as unknown as AccessControlService;

        gauge = {
            set: jest.fn(),
        } as unknown as Gauge;

        service = new ActionDispatcherService(
            actionRepo,
            templateRepo,
            workerRepo,
            gauge,
            gauge,
            gauge,
            gauge,
            gauge,
            accessControlService,
        );
    });

    test('dispatch should mark action as UNPROCESSABLE when queue rejection occurs after retry', async () => {
        const mission = { uuid: 'mission-uuid' } as MissionEntity;
        const creator = {
            uuid: 'user-uuid',
            role: UserRole.USER,
        } as UserEntity;

        (templateRepo.findOneOrFail as jest.Mock).mockResolvedValue({
            uuid: 'template-uuid',
            cpuCores: 1,
            cpuMemory: 512,
            gpuMemory: 0,
            maxRuntime: 60,
            accessRights: 0,
        });

        (accessControlService.canAccessMission as jest.Mock).mockResolvedValue(
            true,
        );

        (actionRepo.create as jest.Mock).mockImplementation(
            (d) => d as ActionEntity,
        );
        const saveSpy = (actionRepo.save as jest.Mock).mockImplementation((d) =>
            Promise.resolve({ ...d, uuid: 'action-uuid' } as ActionEntity),
        );
        const updateSpy = (actionRepo.update as jest.Mock).mockResolvedValue(
            {},
        );

        // Mock addActionQueue to return undefined (failure)
        const addActionQueueSpy = (
            schedulingLogic.addActionQueue as jest.Mock
        ).mockImplementation(() => Promise.resolve());

        // Spy on healthCheck
        const healthCheckSpy = jest
            .spyOn(service, 'healthCheck')
            .mockImplementation(() => Promise.resolve());

        await expect(
            service.dispatch(
                'template-uuid',
                mission,
                creator,
                {},
                ActionTriggerSource.MANUAL,
            ),
        ).rejects.toThrow('No worker available');

        expect(updateSpy).toHaveBeenCalledWith('action-uuid', {
            state: ActionState.UNPROCESSABLE,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            state_cause: 'Resources unavailable or queue error',
        });

        expect(saveSpy).toHaveBeenCalled();
        expect(healthCheckSpy).toHaveBeenCalled();
        expect(addActionQueueSpy).toHaveBeenCalledTimes(2);
    });

    describe('stopAction', () => {
        test('should successfully stop running action, remove from queue and publish cancellation', async () => {
            const mockManager = {
                findOne: jest.fn().mockResolvedValue({
                    uuid: 'action-uuid',
                    worker: {
                        identifier: 'worker-identifier',
                    },
                    state: ActionState.PROCESSING,
                }),
                save: jest.fn().mockResolvedValue({}),
            };

            (actionRepo.manager.transaction as jest.Mock).mockImplementation(
                (
                    callback: (mgr: EntityManager) => Promise<unknown>,
                ): Promise<unknown> => {
                    return callback(mockManager as unknown as EntityManager);
                },
            );

            const mockJob = {
                remove: jest.fn().mockResolvedValue(void 0),
            };
            const mockQueue = {
                getJob: jest.fn().mockResolvedValue(mockJob),
            };
            const mockActionQueues: Record<string, unknown> = {
                ['worker-identifier']: mockQueue,
            };
            (service as unknown as Record<string, unknown>).actionQueues =
                mockActionQueues;

            const mockRedis = {
                publish: jest.fn().mockResolvedValue(1),
            };
            (service as unknown as Record<string, unknown>).redisPublisher =
                mockRedis;

            await service.stopAction('action-uuid');

            expect(mockManager.findOne).toHaveBeenCalledWith(ActionEntity, {
                where: { uuid: 'action-uuid' },
                relations: { worker: true },
            });
            expect(mockManager.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    uuid: 'action-uuid',
                    state: ActionState.CANCELLED,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    state_cause: 'Action cancelled by user',
                }),
            );
            expect(mockQueue.getJob).toHaveBeenCalledWith('action-uuid');
            expect(mockJob.remove).toHaveBeenCalled();
            expect(mockRedis.publish).toHaveBeenCalledWith(
                'action-cancellation',
                'action-uuid',
            );
        });

        test('should throw Error if no worker found for the action', async () => {
            const mockManager = {
                findOne: jest.fn().mockResolvedValue({
                    uuid: 'action-uuid',
                    worker: undefined,
                    state: ActionState.PROCESSING,
                }),
            };

            (actionRepo.manager.transaction as jest.Mock).mockImplementation(
                (
                    callback: (mgr: EntityManager) => Promise<unknown>,
                ): Promise<unknown> => {
                    return callback(mockManager as unknown as EntityManager);
                },
            );

            await expect(service.stopAction('action-uuid')).rejects.toThrow(
                'No worker found for this action',
            );
        });

        test('should throw ConflictException if worker queue is not active', async () => {
            const mockManager = {
                findOne: jest.fn().mockResolvedValue({
                    uuid: 'action-uuid',
                    worker: {
                        identifier: 'inactive-worker',
                    },
                    state: ActionState.PROCESSING,
                }),
                save: jest.fn().mockResolvedValue({}),
            };

            (actionRepo.manager.transaction as jest.Mock).mockImplementation(
                (
                    callback: (mgr: EntityManager) => Promise<unknown>,
                ): Promise<unknown> => {
                    return callback(mockManager as unknown as EntityManager);
                },
            );

            (service as unknown as Record<string, unknown>).actionQueues = {};

            await expect(service.stopAction('action-uuid')).rejects.toThrow(
                'Worker queue not active',
            );
        });

        test('should publish cancellation even if job is not found in the queue', async () => {
            const mockManager = {
                findOne: jest.fn().mockResolvedValue({
                    uuid: 'action-uuid',
                    worker: {
                        identifier: 'worker-identifier',
                    },
                    state: ActionState.PROCESSING,
                }),
                save: jest.fn().mockResolvedValue({}),
            };

            (actionRepo.manager.transaction as jest.Mock).mockImplementation(
                (
                    callback: (mgr: EntityManager) => Promise<unknown>,
                ): Promise<unknown> => {
                    return callback(mockManager as unknown as EntityManager);
                },
            );

            const mockQueue = {
                getJob: jest.fn().mockResolvedValue(null),
            };
            const mockActionQueues: Record<string, unknown> = {
                ['worker-identifier']: mockQueue,
            };
            (service as unknown as Record<string, unknown>).actionQueues =
                mockActionQueues;

            const mockRedis = {
                publish: jest.fn().mockResolvedValue(1),
            };
            (service as unknown as Record<string, unknown>).redisPublisher =
                mockRedis;

            await service.stopAction('action-uuid');

            expect(mockQueue.getJob).toHaveBeenCalledWith('action-uuid');
            expect(mockRedis.publish).toHaveBeenCalledWith(
                'action-cancellation',
                'action-uuid',
            );
        });
    });
});
