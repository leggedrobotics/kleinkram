import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ConflictException } from '@nestjs/common';
import { MissionService } from '@/services/mission.service';
import { QueryFailedError } from 'typeorm';

const createService = () => {
    const missionFindOneInTx = jest.fn();
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
                    getRepository: () => { update: jest.Mock };
                }) => Promise<void>,
            ) => {
                await callback({
                    getRepository: () => ({
                        findOne: missionFindOneInTx,
                        exists: missionExistsInTx,
                        update: updateMock,
                    }),
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
        missionFindOneInTx,
        missionExistsInTx,
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
            missionFindOneInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
            updateMock,
        } = createService();

        missionFindOneInTx.mockResolvedValue({
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
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await service.migrateMission(
            missionUUID,
            targetProjectUUID,
            'renamed_mission',
        );

        expect(updateMock).toHaveBeenCalledWith(
            {
                uuid: missionUUID,
                project: { uuid: sourceProjectUUID },
            },
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
            missionFindOneInTx,
            missionExistsInTx,
            projectRepository,
            updateMock,
        } =
            createService();

        missionFindOneInTx.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: sourceProjectUUID },
            files: [],
        } as unknown as MissionEntity);
        missionExistsInTx.mockResolvedValue(true);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('throws when target project matches current project', async () => {
        const {
            service,
            missionFindOneInTx,
            missionExistsInTx,
            projectRepository,
            updateMock,
        } =
            createService();

        missionFindOneInTx.mockResolvedValue({
            uuid: missionUUID,
            name: 'source_mission',
            project: { uuid: targetProjectUUID },
            files: [],
        } as unknown as MissionEntity);
        missionExistsInTx.mockResolvedValue(false);
        projectRepository.findOne.mockResolvedValue({
            uuid: targetProjectUUID,
        });

        await expect(
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(updateMock).not.toHaveBeenCalled();
    });

    test('restores tags when migration tagging fails', async () => {
        const {
            service,
            missionFindOneInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
        } = createService();

        missionFindOneInTx.mockResolvedValue({
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
        missionExistsInTx.mockResolvedValue(false);
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
            missionFindOneInTx,
            missionExistsInTx,
            projectRepository,
            storageService,
            updateMock,
        } = createService();

        missionFindOneInTx.mockResolvedValue({
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
            service.migrateMission(missionUUID, targetProjectUUID),
        ).rejects.toThrow(ConflictException);
        expect(storageService.addTags).not.toHaveBeenCalled();
    });
});
