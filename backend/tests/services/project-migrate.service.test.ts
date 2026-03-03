import { ProjectService } from '@/services/project.service';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const createService = () => {
    const missionFindInTx = jest.fn();
    const projectFindOneInTx = jest.fn();
    const projectExistsInTx = jest.fn();
    const storageService = {
        addTags: jest.fn().mockResolvedValue(null),
    };
    const missionUpdateMock = jest.fn().mockResolvedValue({ affected: 1 });
    const projectUpdateMock = jest.fn().mockResolvedValue(null);
    const dataSource = {
        transaction: jest.fn(
            async (
                callback: (manager: {
                    getRepository: (repository: unknown) => {
                        update: jest.Mock;
                    };
                }) => Promise<void>,
            ) => {
                await callback({
                    getRepository: (repository: unknown) => {
                        if (repository === MissionEntity) {
                            return {
                                find: missionFindInTx,
                                update: missionUpdateMock,
                            };
                        }
                        if (repository === ProjectEntity) {
                            return {
                                findOne: projectFindOneInTx,
                                exists: projectExistsInTx,
                                update: projectUpdateMock,
                            };
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
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        configService as never,
        dataSource as never,
        storageService as never,
    );

    return {
        service,
        projectFindOneInTx,
        projectExistsInTx,
        missionFindInTx,
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
        const {
            service,
            projectFindOneInTx,
            projectExistsInTx,
            missionFindInTx,
            dataSource,
        } = createService();

        projectFindOneInTx.mockResolvedValue({});
        projectExistsInTx.mockResolvedValue(false);
        missionFindInTx
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

        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    test('migrates all missions and returns summary', async () => {
        const {
            service,
            projectFindOneInTx,
            projectExistsInTx,
            missionFindInTx,
            storageService,
            missionUpdateMock,
            projectUpdateMock,
        } = createService();

        projectFindOneInTx.mockResolvedValue({});
        projectExistsInTx.mockResolvedValue(false);
        missionFindInTx
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
            {
                uuid: 'aaaa1111-1111-4111-8111-111111111111',
                project: { uuid: sourceProjectUUID },
            },
            {
                project: { uuid: targetProjectUUID },
            },
        );
        expect(missionUpdateMock).toHaveBeenCalledWith(
            {
                uuid: 'bbbb2222-2222-4222-8222-222222222222',
                project: { uuid: sourceProjectUUID },
            },
            {
                project: { uuid: targetProjectUUID },
            },
        );
        expect(projectUpdateMock).toHaveBeenCalledTimes(1);
        expect(projectUpdateMock).toHaveBeenCalledWith(
            { uuid: sourceProjectUUID },
            {
                name: 'legacy_source',
            },
        );
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
        const {
            service,
            projectFindOneInTx,
            projectExistsInTx,
            missionFindInTx,
            storageService,
        } = createService();

        projectFindOneInTx.mockResolvedValue({});
        projectExistsInTx.mockResolvedValue(false);
        missionFindInTx
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
        const { service, projectFindOneInTx, projectExistsInTx, dataSource } =
            createService();

        projectFindOneInTx.mockResolvedValue({});
        projectExistsInTx.mockResolvedValue(true);

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID,
                archiveSourceProjectAs: 'legacy_source',
            }),
        ).rejects.toThrow(ConflictException);
        expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    test('maps unique-violation to conflict without rollback masking', async () => {
        const {
            service,
            projectFindOneInTx,
            projectExistsInTx,
            missionFindInTx,
            missionUpdateMock,
            storageService,
        } = createService();

        projectFindOneInTx.mockResolvedValue({});
        projectExistsInTx.mockResolvedValue(false);
        missionFindInTx
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
        missionUpdateMock.mockRejectedValue(
            new QueryFailedError('UPDATE mission', [], {
                code: '23505',
            } as unknown as Error),
        );

        await expect(
            service.migrateProject({
                sourceProjectUUID,
                targetProjectUUID,
            }),
        ).rejects.toThrow(ConflictException);
        expect(storageService.addTags).not.toHaveBeenCalled();
    });
});
