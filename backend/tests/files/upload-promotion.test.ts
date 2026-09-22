import { ProjectEntity } from '@kleinkram/backend-common';

import {
    FileEntity,
    IngestionJobEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileOrigin, FileState, FileType } from '@kleinkram/shared';
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

const mockGauge = { set: jest.fn() };

/**
 * Upload credentials are scoped to an object's staging key and cannot be
 * revoked, so confirming an upload has to move the object off that key. These
 * tests pin that behaviour, including the case where a client writes to the
 * staging key again after its file was already confirmed.
 */
describe('QueueService - promoting confirmed uploads', () => {
    let queueService: QueueService;
    let dataStorage: {
        getFileInfo: jest.Mock;
        getStagedFileInfo: jest.Mock;
        promoteStagedFile: jest.Mock;
        deleteStagedFile: jest.Mock;
    };
    let auditService: { log: jest.Mock };
    let fileRepository: Repository<FileEntity>;
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
        missionRepository = database.getRepository(MissionEntity);

        const userUuid = await mockDatabaseUser('test@example.com');
        user = await getUserFromDatabase(userUuid);

        const project = await database.getRepository(ProjectEntity).save({
            name: 'Test Project',
            description: 'Test Description',
            creator: user,
        });
        const mission = await missionRepository.save({
            name: 'Test Mission',
            project,
            creator: user,
            date: new Date(),
        });
        missionUuid = mission.uuid;

        dataStorage = {
            getFileInfo: jest.fn().mockResolvedValue({ size: 1024 }),
            getStagedFileInfo: jest.fn().mockResolvedValue({ size: 1024 }),
            promoteStagedFile: jest.fn().mockResolvedValue(undefined),
            deleteStagedFile: jest.fn().mockResolvedValue(undefined),
        };
        auditService = { log: jest.fn() };

        queueService = new QueueService(
            database.getRepository(IngestionJobEntity),
            missionRepository,
            fileRepository,
            { findOneByUUID: jest.fn() } as unknown as UserService,
            auditService as unknown as FileAuditService,
            mockGauge as unknown as Gauge,
            mockGauge as unknown as Gauge,
            mockGauge as unknown as Gauge,
            mockGauge as unknown as Gauge,
            {
                addFileEvent: jest.fn().mockResolvedValue(undefined),
            } as unknown as TriggerService,
            dataStorage as unknown as IStorageBucket,
        );

        Object.defineProperty(queueService, 'fileQueue', {
            value: { add: jest.fn().mockResolvedValue({}) },
            writable: true,
        });
    });

    const createUploadingFile = async (filename: string): Promise<FileEntity> =>
        fileRepository.save({
            filename,
            mission: { uuid: missionUuid },
            creator: user,
            type: FileType.BAG,
            state: FileState.UPLOADING,
            origin: FileOrigin.UPLOAD,
            date: new Date(),
            size: 0,
        });

    it('moves a staged upload onto the served key before it is processed', async () => {
        const file = await createUploadingFile('staged.bag');
        // Nothing on the served key until the upload is promoted.
        dataStorage.getFileInfo
            .mockResolvedValueOnce(undefined)
            .mockResolvedValue({ size: 1024 });

        await queueService.confirmUpload(file.uuid, 'hash', user);

        expect(dataStorage.promoteStagedFile).toHaveBeenCalledWith(file.uuid);
        const updated = await fileRepository.findOne({
            where: { uuid: file.uuid },
        });
        expect(updated?.state).toBe(FileState.OK);
    });

    it('confirms uploads from clients that write straight to the served key', async () => {
        const file = await createUploadingFile('legacy.bag');
        dataStorage.getStagedFileInfo.mockResolvedValue(undefined);

        await queueService.confirmUpload(file.uuid, 'hash', user);

        expect(dataStorage.promoteStagedFile).not.toHaveBeenCalled();
        const updated = await fileRepository.findOne({
            where: { uuid: file.uuid },
        });
        expect(updated?.state).toBe(FileState.OK);
    });

    it('discards bytes written to the staging key after the file was promoted', async () => {
        const file = await createUploadingFile('overwritten.bag');
        // Both keys hold data: the file was promoted by an earlier confirm
        // and the credentials were then used again.
        dataStorage.getStagedFileInfo.mockResolvedValue({ size: 99 });
        dataStorage.getFileInfo.mockResolvedValue({ size: 1024 });

        await queueService.confirmUpload(file.uuid, 'hash', user);

        expect(dataStorage.promoteStagedFile).not.toHaveBeenCalled();
        expect(dataStorage.deleteStagedFile).toHaveBeenCalledWith(file.uuid);
        // The promoted object is what gets confirmed, not the 99 bytes that
        // were written afterwards.
        const updated = await fileRepository.findOne({
            where: { uuid: file.uuid },
        });
        expect(updated?.size).toBe(1024);
    });
});
