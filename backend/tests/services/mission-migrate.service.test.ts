import { MissionService } from '@/services/mission.service';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

const createService = () => {
    const missionFindInTx = jest.fn();
    const missionExistsInTx = jest.fn();
    const projectRepository = {
        findOne: jest.fn(),
    };
    const storageService = {
        addTags: jest.fn().mockResolvedValue(null),
    };
    const updateMock = jest.fn().mockResolvedValue({ affected: 1 });
    const dataSource = {
        transaction: jest.fn(
            async (
                callback: (manager: {
                    getRepository: (repository: unknown) => {
                        update?: jest.Mock;
                        find?: jest.Mock;
                        findOne?: jest.Mock;
                        exists?: jest.Mock;
                    };
                }) => Promise<void>,
            ) => {
                await callback({
                    getRepository: (repository: unknown) => {
                        if (repository === MissionEntity) {
                            return {
                                find: missionFindInTx,
                                exists: missionExistsInTx,
                                update: updateMock,
                            };
                        }
                        if (repository === ProjectEntity) {
                            return {
                                findOne: projectRepository.findOne,
                            };
                        }
                        throw new Error('Unexpected repository requested');
                    },
                });
            },
        ),
    };

    const service = new MissionService(
        {} as never,
        projectRepository as never,
        {} as never,
        {} as never,
        {} as never,
        storageService as never,
        dataSource as never,
    );

    return {
        service,
        missionFindInTx,
        missionExistsInTx,
        projectRepository,
        storageService,
        dataSource,
        updateMock,
    };
};

describe('MissionService.moveMissions', () => {
    const missionUUID = '11111111-1111-4111-8111-111111111111';
    const targetProjectUUID = '22222222-2222-4222-8222-222222222222';
    const sourceProjectUUID = '33333333-3333-4333-8333-333333333333';

    test('migrates mission and retags files', async () => {
        const {
            service,
            missionFindInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
            updateMock,
        } = createService();

        missionFindInTx.mockResolvedValue([
            {
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
            },
        ] as unknown as MissionEntity[]);
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await service.moveMissions(
            [missionUUID],
            targetProjectUUID,
            'renamed_mission',
        );

        expect(updateMock).toHaveBeenCalledWith(
            { uuid: missionUUID },
            {
                name: 'renamed_mission',
                project: { uuid: targetProjectUUID },
            },
        );
        expect(storageService.addTags).toHaveBeenCalledTimes(2);
        expect(storageService.addTags).toHaveBeenNthCalledWith(
            1,
            'aaaa1111-1111-4111-8111-111111111111',
            {
                filename: 'a.mcap',
                missionUuid: missionUUID,
                projectUuid: targetProjectUUID,
            },
        );
        expect(storageService.addTags).toHaveBeenNthCalledWith(
            2,
            'bbbb2222-2222-4222-8222-222222222222',
            {
                filename: 'b.mcap',
                missionUuid: missionUUID,
                projectUuid: targetProjectUUID,
            },
        );
    });

    test('throws on target name collision before update', async () => {
        const {
            service,
            missionFindInTx,
            missionExistsInTx,
            projectRepository,
            updateMock,
        } = createService();

        missionFindInTx.mockResolvedValue([
            {
                uuid: missionUUID,
                name: 'source_mission',
                project: { uuid: sourceProjectUUID },
                files: [],
            },
        ] as unknown as MissionEntity[]);
        missionExistsInTx.mockResolvedValue(true);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.moveMissions([missionUUID], targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('throws when target project matches current project', async () => {
        const {
            service,
            missionFindInTx,
            missionExistsInTx,
            projectRepository,
            updateMock,
        } = createService();

        missionFindInTx.mockResolvedValue([
            {
                uuid: missionUUID,
                name: 'source_mission',
                project: { uuid: targetProjectUUID },
                files: [],
            },
        ] as unknown as MissionEntity[]);
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.moveMissions([missionUUID], targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('restores tags when migration tagging fails', async () => {
        const {
            service,
            missionFindInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
        } = createService();

        missionFindInTx.mockResolvedValue([
            {
                uuid: missionUUID,
                name: 'source_mission',
                project: { uuid: sourceProjectUUID },
                files: [
                    {
                        uuid: 'aaaa1111-1111-4111-8111-111111111111',
                        filename: 'a.mcap',
                    },
                ],
            },
        ] as unknown as MissionEntity[]);
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        storageService.addTags
            .mockRejectedValueOnce(new Error('failed to set tags'))
            .mockResolvedValue(null);

        await expect(
            service.moveMissions([missionUUID], targetProjectUUID),
        ).rejects.toThrow('failed to set tags');

        expect(storageService.addTags).toHaveBeenNthCalledWith(
            2,
            'aaaa1111-1111-4111-8111-111111111111',
            {
                filename: 'a.mcap',
                missionUuid: missionUUID,
                projectUuid: sourceProjectUUID,
            },
        );
    });

    test('maps unique-violation to conflict without rollback masking', async () => {
        const {
            service,
            missionFindInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
            updateMock,
        } = createService();

        missionFindInTx.mockResolvedValue([
            {
                uuid: missionUUID,
                name: 'source_mission',
                project: { uuid: sourceProjectUUID },
                files: [
                    {
                        uuid: 'aaaa1111-1111-4111-8111-111111111111',
                        filename: 'a.mcap',
                    },
                ],
            },
        ] as unknown as MissionEntity[]);
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });
        updateMock.mockRejectedValue(
            new QueryFailedError('UPDATE mission', [], {
                code: '23505',
            } as unknown as Error),
        );

        await expect(
            service.moveMissions([missionUUID], targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(storageService.addTags).not.toHaveBeenCalled();
    });
});
