import { ActionEntity, WorkerEntity } from '@kleinkram/backend-common';
import {
    addActionQueue,
    findWorkerForAction,
} from '@kleinkram/backend-common/scheduling-logic';
import { ActionState } from '@kleinkram/shared';
import { MoreThanOrEqual, Repository } from 'typeorm';

describe('Action Scheduling Logic Unit Tests', () => {
    let mockWorkerRepository: Record<string, jest.Mock>;
    let mockActionRepository: Record<string, jest.Mock>;
    let mockLogger: Record<string, jest.Mock>;
    let mockActionQueues: Record<string, Record<string, jest.Mock | string>>;

    beforeEach(() => {
        mockWorkerRepository = {
            find: jest.fn(),
        };

        mockActionRepository = {
            save: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({}),
        };

        mockLogger = {
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            info: jest.fn(),
        };

        mockActionQueues = {};
    });

    describe('findWorkerForAction', () => {
        test('should return undefined if no workers match hardware requirements', async () => {
            mockWorkerRepository.find.mockResolvedValue([]);

            const worker = await findWorkerForAction(
                { cpuCores: 2, cpuMemory: 4, gpuMemory: 0, maxRuntime: 60 },
                mockWorkerRepository as unknown as Repository<WorkerEntity>,
                mockActionQueues as unknown as Record<string, unknown>,
                mockLogger as unknown as import('winston').Logger,
            );

            expect(mockWorkerRepository.find).toHaveBeenCalledWith({
                where: {
                    reachable: true,
                    cpuMemory: MoreThanOrEqual(5), // 4 + 1
                    cpuCores: MoreThanOrEqual(2),
                    gpuMemory: MoreThanOrEqual(0),
                },
                order: { hostname: 'DESC' },
            });
            expect(worker).toBeUndefined();
        });

        test('should skip workers that do not have an active queue initialized', async () => {
            const workers = [
                { identifier: 'worker-1', hostname: 'host1' },
                { identifier: 'worker-2', hostname: 'host2' },
            ] as WorkerEntity[];

            mockWorkerRepository.find.mockResolvedValue(workers);

            // Only worker-2 has a queue initialized
            mockActionQueues['worker-2'] = {
                count: jest.fn().mockResolvedValue(0),
            };

            const worker = await findWorkerForAction(
                { cpuCores: 1, cpuMemory: 1, gpuMemory: 0, maxRuntime: 60 },
                mockWorkerRepository as unknown as Repository<WorkerEntity>,
                mockActionQueues as unknown as Record<string, unknown>,
                mockLogger as unknown as import('winston').Logger,
            );

            expect(worker?.identifier).toBe('worker-2');
        });

        test('should pick the worker with the fewest jobs in its queue', async () => {
            const workers = [
                { identifier: 'worker-A', hostname: 'hostA' },
                { identifier: 'worker-B', hostname: 'hostB' },
                { identifier: 'worker-C', hostname: 'hostC' },
            ] as WorkerEntity[];

            mockWorkerRepository.find.mockResolvedValue(workers);

            mockActionQueues['worker-A'] = {
                count: jest.fn().mockResolvedValue(5),
            };
            mockActionQueues['worker-B'] = {
                count: jest.fn().mockResolvedValue(2),
            };
            mockActionQueues['worker-C'] = {
                count: jest.fn().mockResolvedValue(7),
            };

            const worker = await findWorkerForAction(
                { cpuCores: 1, cpuMemory: 1, gpuMemory: 0, maxRuntime: 60 },
                mockWorkerRepository as unknown as Repository<WorkerEntity>,
                mockActionQueues as unknown as Record<string, unknown>,
                mockLogger as unknown as import('winston').Logger,
            );

            expect(worker?.identifier).toBe('worker-B');
        });
    });

    describe('addActionQueue', () => {
        const runtimeDesc = {
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: 0,
            maxRuntime: 60,
        };

        test('should mark action as UNPROCESSABLE if no worker can be found', async () => {
            const action = {
                uuid: 'action-uuid-1',
                state: ActionState.PENDING,
            } as ActionEntity;

            mockWorkerRepository.find.mockResolvedValue([]);

            await addActionQueue(
                action,
                runtimeDesc,
                mockWorkerRepository as unknown as Repository<WorkerEntity>,
                mockActionRepository as unknown as Repository<ActionEntity>,
                mockActionQueues as unknown as Record<string, unknown>,
                mockLogger as unknown as import('winston').Logger,
            );

            expect(action.state).toBe(ActionState.UNPROCESSABLE);
            expect(action.state_cause).toContain('No worker available');
            expect(mockActionRepository.save).toHaveBeenCalledWith(action);
        });

        test('should assign worker and add job to queue if worker is found', async () => {
            const action = { uuid: 'action-uuid-2' } as ActionEntity;
            const worker = { identifier: 'worker-1' } as WorkerEntity;

            mockWorkerRepository.find.mockResolvedValue([worker]);

            const mockAdd = jest.fn().mockResolvedValue(true);
            mockActionQueues['worker-1'] = {
                name: 'worker-1-queue',
                count: jest.fn().mockResolvedValue(0),
                add: mockAdd,
            };

            await addActionQueue(
                action,
                runtimeDesc,
                mockWorkerRepository as unknown as Repository<WorkerEntity>,
                mockActionRepository as unknown as Repository<ActionEntity>,
                mockActionQueues as unknown as Record<string, unknown>,
                mockLogger as unknown as import('winston').Logger,
            );

            // DB was updated
            expect(mockActionRepository.execute).toHaveBeenCalled();
            expect(mockActionRepository.set).toHaveBeenCalledWith({ worker });
            expect(mockActionRepository.where).toHaveBeenCalledWith(
                'uuid = :uuid',
                { uuid: action.uuid },
            );

            // Queue received the job
            expect(mockAdd).toHaveBeenCalledWith(
                'action',
                { uuid: action.uuid },
                expect.objectContaining({
                    jobId: action.uuid,
                    removeOnComplete: true,
                }),
            );
        });
    });
});
