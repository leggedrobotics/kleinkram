import { ProjectEntity } from '@kleinkram/backend-common';

jest.mock('uuid', () => ({
    v4: () => 'test-uuid',
}));

import {
    FileEntity,
    IngestionJobEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import {
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
} from '@kleinkram/shared';
import { Gauge } from 'prom-client';
import { Repository } from 'typeorm';
import QueueService from '../../src/services/queue.service';
import { TriggerService } from '../../src/services/trigger.service';
import { UserService } from '../../src/services/user.service';
import {
    clearAllData,
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

// Mock dependencies
const mockDataStorage = {
    getFileInfo: jest.fn().mockResolvedValue({ size: 1024 }),
};

const mockFileAuditService = {
    log: jest.fn(),
};

const mockGauge = {
    set: jest.fn(),
};

const mockTriggerService = {
    // eslint-disable-next-line unicorn/no-useless-undefined
    addFileEvent: jest.fn().mockResolvedValue(undefined),
};

describe('Reproduction Issue: File Hash Not Saved', () => {
    let queueService: QueueService;
    let fileRepository: Repository<FileEntity>;
    let queueRepository: Repository<IngestionJobEntity>;
    let missionRepository: Repository<MissionEntity>;
    let user: UserEntity;
    let missionUuid: string;

    beforeAll(async () => {
        await database.initialize();
    });

    afterAll(async () => {
        await database.destroy();
    });

    beforeEach(async () => {
        await clearAllData();

        fileRepository = database.getRepository(FileEntity);
        queueRepository = database.getRepository(IngestionJobEntity);
        missionRepository = database.getRepository(MissionEntity);

        // Setup Data
        const userUuid = await mockDatabaseUser('test@example.com');
        user = await getUserFromDatabase(userUuid);

        const project = await database.getRepository(ProjectEntity).save({
            name: 'Test Project',
            description: 'Test Description',
            creator: user,
        });

        const mission = await missionRepository.save({
            name: 'Test Mission',
            project: project,
            creator: user,
            date: new Date(),
        });
        missionUuid = mission.uuid;

        // Instantiate QueueService manually
        queueService = new QueueService(
            queueRepository,
            missionRepository,
            fileRepository,
            { findOneByUUID: jest.fn() } as unknown as UserService, // UserService
            mockFileAuditService as unknown as FileAuditService, // auditService
            mockGauge as unknown as Gauge, // pendingJobs
            mockGauge as unknown as Gauge, // activeJobs
            mockGauge as unknown as Gauge, // completedJobs
            mockGauge as unknown as Gauge, // failedJobs
            mockTriggerService as unknown as TriggerService, // triggerService
            mockDataStorage as unknown as IStorageBucket, // dataStorage
        );

        // Mock the fileQueue property
        Object.defineProperty(queueService, 'fileQueue', {
            value: {
                add: jest.fn().mockResolvedValue({}),
            },
            writable: true,
        });
    });

    it('should save the file hash and source when confirming upload', async () => {
        // 1. Create a file in UPLOADING state
        const file = await fileRepository.save({
            filename: 'test.bag',
            mission: { uuid: missionUuid },
            creator: user,
            type: FileType.BAG,
            state: FileState.UPLOADING,
            origin: FileOrigin.UPLOAD,
            date: new Date(),
            size: 0,
        });

        const testHash = 'd41d8cd98f00b204e9800998ecf8427e'; // MD5 for empty string
        const testSource = 'CLI';

        // 2. Call confirmUpload with source
        await queueService.confirmUpload(file.uuid, testHash, user, testSource);

        // 3. Verify file hash
        const updatedFile = await fileRepository.findOne({
            where: { uuid: file.uuid },
        });

        expect(updatedFile).toBeDefined();
        expect(updatedFile?.state).toBe(FileState.OK);
        expect(updatedFile?.hash).toBe(testHash);

        // 4. Verify file event
        expect(mockFileAuditService.log).toHaveBeenCalledWith(
            FileEventType.UPLOAD_COMPLETED,
            expect.objectContaining({
                fileUuid: file.uuid,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                details: expect.objectContaining({
                    origin: FileOrigin.UPLOAD,
                    source: testSource,
                }),
            }),
            true,
        );
    });

    it('should default source to Web Interface if not provided', async () => {
        // 1. Create a file in UPLOADING state
        const file = await fileRepository.save({
            filename: 'test_default.bag',
            mission: { uuid: missionUuid },
            creator: user,
            type: FileType.BAG,
            state: FileState.UPLOADING,
            origin: FileOrigin.UPLOAD,
            date: new Date(),
            size: 0,
        });

        const testHash = 'd41d8cd98f00b204e9800998ecf8427e';

        // 2. Call confirmUpload without source (should default)
        await queueService.confirmUpload(file.uuid, testHash, user);

        // 3. Verify file event
        expect(mockFileAuditService.log).toHaveBeenCalledWith(
            FileEventType.UPLOAD_COMPLETED,
            expect.objectContaining({
                fileUuid: file.uuid,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                details: expect.objectContaining({
                    origin: FileOrigin.UPLOAD,
                    source: 'Web Interface',
                }),
            }),
            true,
        );
    });
});
