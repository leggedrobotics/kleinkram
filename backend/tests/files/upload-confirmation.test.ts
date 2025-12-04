import ProjectEntity from '@kleinkram/backend-common/project/project.entity';

jest.mock('uuid', () => ({
    v4: () => 'test-uuid',
}));

import {
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
} from '@kleinkram/backend-common';
import MissionEntity from '@kleinkram/backend-common/entities/mission/mission.entity';
import UserEntity from '@kleinkram/backend-common/entities/user/user.entity';
import FileEntity from '@kleinkram/backend-common/file/file.entity';
import IngestionJobEntity from '@kleinkram/backend-common/file/ingestion-job.entity';
import { Repository } from 'typeorm';
import QueueService from '../../src/services/queue.service';
import {
    clearAllData,
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../utils/database-utilities';

// Mock dependencies
const mockStorageService = {
    getFileInfo: jest.fn().mockResolvedValue({ size: 1024 }),
};

const mockFileAuditService = {
    log: jest.fn(),
};

const mockGauge = {
    set: jest.fn(),
};

describe('Reproduction Issue: File Hash Not Saved', () => {
    let queueService: QueueService;
    let fileRepository: Repository<FileEntity>;
    let queueRepository: Repository<IngestionJobEntity>;
    let missionRepository: Repository<MissionEntity>;
    let userRepository: Repository<UserEntity>;
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
        userRepository = database.getRepository(UserEntity);

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
            { findOneByUUID: jest.fn() } as any, // UserService
            mockStorageService as any,
            mockFileAuditService as any,
            mockGauge as any, // pendingJobs
            mockGauge as any, // activeJobs
            mockGauge as any, // completedJobs
            mockGauge as any, // failedJobs
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
                details: expect.objectContaining({
                    origin: FileOrigin.UPLOAD,
                    source: 'Web Interface',
                }),
            }),
            true,
        );
    });
});
