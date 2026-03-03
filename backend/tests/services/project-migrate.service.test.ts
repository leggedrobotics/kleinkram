import { ProjectService } from '@/services/project.service';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { ConflictException } from '@nestjs/common';

const createService = () => {
    const projectRepository = {
        findOne: jest.fn(),
        exists: jest.fn(),
    };
    const missionRepository = {
        find: jest.fn(),
    };
    const storageService = {
        addTags: jest.fn().mockResolvedValue(null),
    };
    const missionUpdateMock = jest.fn().mockResolvedValue(null);
    const projectUpdateMock = jest.fn().mockResolvedValue(null);
    const dataSource = {
        transaction: jest.fn(
            async (
                callback: (manager: {
                    getRepository: (
                        repository: unknown,
                    ) => { update: jest.Mock };
                }) => Promise<void>,
            ) => {
                await callback({
                    getRepository: (repository: unknown) => {
                        if (repository === MissionEntity) {
                            return { update: missionUpdateMock };
                        }
                        if (repository === ProjectEntity) {
                            return { update: projectUpdateMock };
                        }
                        throw new Error('Unexpected repository requested');
                    },
                });
            },
        ),
    };
    const configService = {
        get: jest.fn().mockReturnValue({ ['access_groups']: [] }),
    };

    const service = new ProjectService(
        projectRepository as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        missionRepository as never,
        configService as never,
        dataSource as never,
        storageService as never,
    );

    return {
        service,
        projectRepository,
        missionRepository,
        storageService,
        dataSource,
        missionUpdateMock,
        projectUpdateMock,
    };
};

describe('ProjectService.migrateProject', () => {
    const sourceProjectUUID = '11111111-1111-4111-8111-111111111111';
    const targetProjectUUID = '22222222-2222-4222-8222-222222222222';

    test('throws conflict when target has colliding mission names', async () => {
        const { service, projectRepository, missionRepository, dataSource } =
            createService();

        projectRepository.findOne.mockResolvedValue({});
        projectRepository.exists.mockResolvedValue(false);
        missionRepository.find
            .mockResolvedValueOnce([
                {
                    uuid: 'aaaa1111-1111-4111-8111-111111111111',
                    name: 'mission_1',
                    files: [],
                },
            ])
            .mockResolvedValueOnce([
                {
                    uuid: 'bbbb2222-2222-4222-8222-222222222222',
                    name: 'mission_1',
                },
            ]);

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID,
            }),
        ).rejects.toThrow(ConflictException);

        expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    test('migrates all missions and returns summary', async () => {
        const {
            service,
            projectRepository,
            missionRepository,
            storageService,
            missionUpdateMock,
            projectUpdateMock,
        } = createService();

        projectRepository.findOne.mockResolvedValue({});
        projectRepository.exists.mockResolvedValue(false);
        missionRepository.find
            .mockResolvedValueOnce([
                {
                    uuid: 'aaaa1111-1111-4111-8111-111111111111',
                    name: 'mission_1',
                    files: [
                        {
                            uuid: 'cccc3333-3333-4333-8333-333333333333',
                            filename: 'a.mcap',
                        },
                    ],
                },
                {
                    uuid: 'bbbb2222-2222-4222-8222-222222222222',
                    name: 'mission_2',
                    files: [],
                },
            ])
            .mockResolvedValueOnce([]);

        const result = await service.migrateProject({
            sourceProjectUUID,
            targetProjectUUID,
            archiveSourceProjectAs: 'legacy_source',
        });

        expect(result).toEqual({
            success: true,
            sourceProjectUUID,
            targetProjectUUID,
            movedMissionCount: 2,
            movedFileCount: 1,
            movedMissionUUIDs: [
                'aaaa1111-1111-4111-8111-111111111111',
                'bbbb2222-2222-4222-8222-222222222222',
            ],
        });
        expect(missionUpdateMock).toHaveBeenCalledTimes(2);
        expect(missionUpdateMock).toHaveBeenCalledWith(
            'aaaa1111-1111-4111-8111-111111111111',
            {
                project: { uuid: targetProjectUUID },
            },
        );
        expect(missionUpdateMock).toHaveBeenCalledWith(
            'bbbb2222-2222-4222-8222-222222222222',
            {
                project: { uuid: targetProjectUUID },
            },
        );
        expect(projectUpdateMock).toHaveBeenCalledTimes(1);
        expect(projectUpdateMock).toHaveBeenCalledWith(sourceProjectUUID, {
            name: 'legacy_source',
        });
        expect(storageService.addTags).toHaveBeenCalledTimes(1);
        expect(storageService.addTags).toHaveBeenCalledWith(
            'cccc3333-3333-4333-8333-333333333333',
            {
                filename: 'a.mcap',
                missionUuid: 'aaaa1111-1111-4111-8111-111111111111',
                projectUuid: targetProjectUUID,
            },
        );
    });

    test('restores file tags if migration tagging fails', async () => {
        const { service, projectRepository, missionRepository, storageService } =
            createService();

        projectRepository.findOne.mockResolvedValue({});
        projectRepository.exists.mockResolvedValue(false);
        missionRepository.find
            .mockResolvedValueOnce([
                {
                    uuid: 'aaaa1111-1111-4111-8111-111111111111',
                    name: 'mission_1',
                    files: [
                        {
                            uuid: 'cccc3333-3333-4333-8333-333333333333',
                            filename: 'a.mcap',
                        },
                    ],
                },
            ])
            .mockResolvedValueOnce([]);

        storageService.addTags
            .mockRejectedValueOnce(new Error('retag failed'))
            .mockResolvedValue(null);

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID,
            }),
        ).rejects.toThrow('retag failed');

        expect(storageService.addTags).toHaveBeenNthCalledWith(
            2,
            'cccc3333-3333-4333-8333-333333333333',
            {
                filename: 'a.mcap',
                missionUuid: 'aaaa1111-1111-4111-8111-111111111111',
                projectUuid: sourceProjectUUID,
            },
        );
    });

    test('throws on same source and target project', async () => {
        const { service, dataSource } = createService();

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID: sourceProjectUUID,
            }),
        ).rejects.toThrow('Source and target project must be different');
        expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    test('throws when archive project name is already used', async () => {
        const { service, projectRepository, dataSource } = createService();

        projectRepository.findOne.mockResolvedValue({});
        projectRepository.exists.mockResolvedValue(true);

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID,
                archiveSourceProjectAs: 'legacy_source',
            }),
        ).rejects.toThrow(ConflictException);
        expect(dataSource.transaction).not.toHaveBeenCalled();
    });
});
