jest.mock('@kleinkram/backend-common/environment', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: {
        S3_DATA_BUCKET_NAME: 'test-bucket',
    },
}));

import {
    ActionTemplateEntity,
    CategoryEntity,
    FileEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MissionGuardService } from '../../src/endpoints/auth/mission-guard.service';
import { FileLifecycleService } from '../../src/services/file-lifecycle.service';
import { TriggerService } from '../../src/services/trigger.service';

describe('File Upload Pre-Flight Capacity Check', () => {
    let service: FileLifecycleService;
    let mockGetSystemMetrics: jest.Mock;
    let mockMissionRepo: jest.Mocked<Repository<MissionEntity>>;
    let mockUserRepo: jest.Mocked<Repository<UserEntity>>;
    let mockDataSource: jest.Mocked<DataSource>;

    beforeEach(() => {
        mockGetSystemMetrics = jest.fn().mockResolvedValue({
            usedBytes: 800,
            totalBytes: 1000, // 200 free bytes
        });

        mockMissionRepo = {
            findOneOrFail: jest.fn().mockResolvedValue({
                uuid: 'mission-uuid',
                project: { uuid: 'project-uuid' },
            }),
        } as unknown as jest.Mocked<Repository<MissionEntity>>;

        mockUserRepo = {
            findOneOrFail: jest.fn().mockResolvedValue({ uuid: 'user-uuid' }),
        } as unknown as jest.Mocked<Repository<UserEntity>>;

        const mockDataStorage = {
            getSystemMetrics: mockGetSystemMetrics,
            generateTemporaryCredential: jest.fn().mockResolvedValue({}),
        } as unknown as jest.Mocked<IStorageBucket>;

        mockDataSource = {
            transaction: jest
                .fn()
                .mockImplementation(
                    (callback: (mgr: unknown) => Promise<unknown>) =>
                        callback({
                            find: jest.fn().mockResolvedValue([]),
                            transaction: jest
                                .fn()
                                .mockImplementation(
                                    (
                                        callback2: (
                                            mgr2: unknown,
                                        ) => Promise<unknown>,
                                    ) =>
                                        callback2({
                                            save: jest.fn().mockResolvedValue({
                                                uuid: 'file-uuid',
                                                filename: 'test.bag',
                                            }),
                                            create: jest
                                                .fn()
                                                .mockReturnValue({}),
                                        }),
                                ),
                        }),
                ),
        } as unknown as jest.Mocked<DataSource>;

        service = new FileLifecycleService(
            {} as unknown as jest.Mocked<Repository<FileEntity>>,
            mockMissionRepo,
            mockUserRepo,
            {} as unknown as jest.Mocked<Repository<CategoryEntity>>,
            mockDataStorage,
            mockDataSource,
            { log: jest.fn() } as unknown as jest.Mocked<FileAuditService>,
            {
                addFileEvent: jest.fn(),
            } as unknown as jest.Mocked<TriggerService>,
            {
                canAccessMission: jest.fn().mockResolvedValue(true),
            } as unknown as jest.Mocked<MissionGuardService>,
            {
                findOne: jest.fn(),
            } as unknown as Repository<ActionTemplateEntity>,
            {
                dispatch: jest.fn(),
            } as unknown as ActionDispatcherService,
        );
    });

    it('should generate credentials if requested size fits within free space', async () => {
        const result = await service.getTemporaryAccess(
            ['test.bag'],
            'mission-uuid',
            'user-uuid',
            undefined,
            'CLI',
            [150], // 150 bytes requested < 200 free bytes
        );
        expect(result).toBeDefined();
        expect(mockGetSystemMetrics).toHaveBeenCalledTimes(1);
    });

    it('should allow upload when requested size exactly equals free space', async () => {
        const result = await service.getTemporaryAccess(
            ['test.bag'],
            'mission-uuid',
            'user-uuid',
            undefined,
            'CLI',
            [200], // exactly 200 free bytes
        );
        expect(result).toBeDefined();
        expect(mockGetSystemMetrics).toHaveBeenCalledTimes(1);
    });

    it('should throw INSUFFICIENT_STORAGE if requested size exceeds free space', async () => {
        await expect(
            service.getTemporaryAccess(
                ['test.bag'],
                'mission-uuid',
                'user-uuid',
                undefined,
                'CLI',
                [250], // 250 bytes requested > 200 free bytes
            ),
        ).rejects.toThrow(
            new HttpException(
                'Insufficient storage space on the server',
                HttpStatus.INSUFFICIENT_STORAGE,
            ),
        );
    });

    it('should sum all file sizes for multi-file uploads', async () => {
        // Two files: 100 + 150 = 250 > 200 free bytes
        await expect(
            service.getTemporaryAccess(
                ['a.bag', 'b.bag'],
                'mission-uuid',
                'user-uuid',
                undefined,
                'CLI',
                [100, 150],
            ),
        ).rejects.toThrow(
            new HttpException(
                'Insufficient storage space on the server',
                HttpStatus.INSUFFICIENT_STORAGE,
            ),
        );
    });

    it('should skip capacity check when fileSizes is not provided', async () => {
        const result = await service.getTemporaryAccess(
            ['test.bag'],
            'mission-uuid',
            'user-uuid',
            undefined,
            'CLI',
            // no fileSizes argument
        );
        expect(result).toBeDefined();
        expect(mockGetSystemMetrics).not.toHaveBeenCalled();
    });

    it('should skip capacity check when fileSizes is an empty array', async () => {
        const result = await service.getTemporaryAccess(
            ['test.bag'],
            'mission-uuid',
            'user-uuid',
            undefined,
            'CLI',
            [],
        );
        expect(result).toBeDefined();
        expect(mockGetSystemMetrics).not.toHaveBeenCalled();
    });

    it('should skip capacity check if getSystemMetrics is not implemented on the storage bucket', async () => {
        // Create a custom service instance where the storage bucket does not have getSystemMetrics
        const mockDataStorageNoMetrics = {
            generateTemporaryCredential: jest.fn().mockResolvedValue({}),
        } as unknown as jest.Mocked<IStorageBucket>;

        const serviceNoMetrics = new FileLifecycleService(
            {} as unknown as jest.Mocked<Repository<FileEntity>>,
            mockMissionRepo, // reuse the mocked repo
            mockUserRepo, // reuse the mocked repo
            {} as unknown as jest.Mocked<Repository<CategoryEntity>>,
            mockDataStorageNoMetrics,
            mockDataSource, // reuse the mocked dataSource
            { log: jest.fn() } as unknown as jest.Mocked<FileAuditService>,
            {
                addFileEvent: jest.fn(),
            } as unknown as jest.Mocked<TriggerService>,
            {
                canAccessMission: jest.fn().mockResolvedValue(true),
            } as unknown as jest.Mocked<MissionGuardService>,
            {
                findOne: jest.fn(),
            } as unknown as Repository<ActionTemplateEntity>,
            {
                dispatch: jest.fn(),
            } as unknown as ActionDispatcherService,
        );

        const result = await serviceNoMetrics.getTemporaryAccess(
            ['test.bag'],
            'mission-uuid',
            'user-uuid',
            undefined,
            'CLI',
            [150],
        );
        expect(result).toBeDefined();
    });
});
