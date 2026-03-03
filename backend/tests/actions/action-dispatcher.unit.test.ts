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
import { ConflictException } from '@nestjs/common';
import { Gauge } from 'prom-client';
import { Repository } from 'typeorm';

// Mock scheduling logic
jest.mock('@kleinkram/backend-common/scheduling-logic', () => ({
    addActionQueue: jest.fn(),
}));

// Mock axios for Loki health check
jest.mock('axios', () => ({
    get: jest.fn().mockResolvedValue({ status: 200 }),
}));

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
        } as ActionTemplateEntity);

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
        ).rejects.toThrow(ConflictException);

        expect(updateSpy).toHaveBeenCalledWith('action-uuid', {
            state: ActionState.UNPROCESSABLE,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            state_cause: 'Resources unavailable or queue error',
        });

        expect(saveSpy).toHaveBeenCalled();
        expect(healthCheckSpy).toHaveBeenCalled();
        expect(addActionQueueSpy).toHaveBeenCalledTimes(2);
    });
});
