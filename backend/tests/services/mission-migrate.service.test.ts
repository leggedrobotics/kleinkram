import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ConflictException } from '@nestjs/common';
import { MissionService } from '@/services/mission.service';

const createService = () => {
    const missionRepository = {
        findOne: jest.fn(),
        exists: jest.fn(),
    };
    const projectRepository = {
        findOne: jest.fn(),
    };
    const storageService = {
        addTags: jest.fn().mockResolvedValue(null),
    };
    const updateMock = jest.fn().mockResolvedValue(null);
    const dataSource = {
        transaction: jest.fn(
            async (
                callback: (manager: {
                    getRepository: () => { update: jest.Mock };
                }) => Promise<void>,
            ) => {
                await callback({
                    getRepository: () => ({
                        update: updateMock,
                    }),
                });
            },
        ),
    };

    const service = new MissionService(
        missionRepository as never,
        projectRepository as never,
        {} as never,
        {} as never,
        {} as never,
        storageService as never,
        dataSource as never,
    );

    return {
        service,
        missionRepository,
        projectRepository,
        storageService,
        dataSource,
        updateMock,
    };
};

describe('MissionService.migrateMission', () => {
    const missionUUID = '11111111-1111-4111-8111-111111111111';
    const targetProjectUUID = '22222222-2222-4222-8222-222222222222';
    const sourceProjectUUID = '33333333-3333-4333-8333-333333333333';

    test('migrates mission and retags files', async () => {
        const {
            service,
            missionRepository,
            projectRepository,
            storageService,
            updateMock,
        } = createService();

        missionRepository.findOne.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: sourceProjectUUID },
            files: [
                {
                    uuid: 'aaaa1111-1111-4111-8111-111111111111',
                    filename: 'a.mcap',
                },
                {
                    uuid: 'bbbb2222-2222-4222-8222-222222222222',
                    filename: 'b.mcap',
                },
            ],
        } as unknown as MissionEntity);
        missionRepository.exists.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await service.migrateMission(
            missionUUID,
            targetProjectUUID,
            'renamed_mission',
        );

        expect(updateMock).toHaveBeenCalledWith(missionUUID, {
            name: 'renamed_mission',
            project: { uuid: targetProjectUUID },
        });
        expect(storageService.addTags).toHaveBeenCalledTimes(2);
    });

    test('throws on target name collision before update', async () => {
        const { service, missionRepository, projectRepository, updateMock } =
            createService();

        missionRepository.findOne.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: sourceProjectUUID },
            files: [],
        } as unknown as MissionEntity);
        missionRepository.exists.mockResolvedValue(true);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('throws when target project matches current project', async () => {
        const { service, missionRepository, projectRepository, updateMock } =
            createService();

        missionRepository.findOne.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: targetProjectUUID },
            files: [],
        } as unknown as MissionEntity);
        missionRepository.exists.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('restores tags when migration tagging fails', async () => {
        const { service, missionRepository, projectRepository, storageService } =
            createService();

        missionRepository.findOne.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: sourceProjectUUID },
            files: [
                {
                    uuid: 'aaaa1111-1111-4111-8111-111111111111',
                    filename: 'a.mcap',
                },
            ],
        } as unknown as MissionEntity);
        missionRepository.exists.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        storageService.addTags
            .mockRejectedValueOnce(new Error('failed to set tags'))
            .mockResolvedValue(null);

        await expect(
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow('failed to set tags');

        expect(storageService.addTags).toHaveBeenNthCalledWith(
            2,
            expect.any(String),
            'aaaa1111-1111-4111-8111-111111111111',
            {
                filename: 'a.mcap',
                missionUuid: missionUUID,
                projectUuid: sourceProjectUUID,
            },
        );
    });
});
