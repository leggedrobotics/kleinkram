import { ProjectService } from '@/services/project.service';
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
    const configService = {
        get: jest.fn().mockReturnValue({ accessGroups: [] }),
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
        updateMock,
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
            updateMock,
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
        expect(updateMock).toHaveBeenCalledTimes(3);
        expect(storageService.addTags).toHaveBeenCalledTimes(1);
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
            expect.any(String),
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
