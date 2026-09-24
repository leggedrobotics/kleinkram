jest.mock('@kleinkram/backend-common/environment', () => ({
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    __esModule: true,
    default: {
        S3_DATA_BUCKET_NAME: 'test-bucket',
    },
}));

import { TemporaryAccessRequestDto } from '@kleinkram/api-dto';
import {
    CategoryEntity,
    FileEntity,
    MissionEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileState, MAX_FILES_PER_UPLOAD_REQUEST } from '@kleinkram/shared';
import { ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DataSource, Repository } from 'typeorm';
import { MissionGuardService } from '../../src/endpoints/auth/mission-guard.service';
import { FileLifecycleService } from '../../src/services/file-lifecycle.service';
import { TriggerService } from '../../src/services/trigger.service';

const MISSION_UUID = '6f1c1a4e-3b8f-4f0e-9d2a-1c2b3d4e5f60';

const errorsFor = (plain: object): string[] =>
    validateSync(plainToInstance(TemporaryAccessRequestDto, plain)).map(
        (error) => error.property,
    );

describe('TemporaryAccessRequestDto', () => {
    it('accepts a normal request', () => {
        expect(
            errorsFor({
                filenames: ['first.bag'],
                missionUUID: MISSION_UUID,
                fileSizes: [0],
            }),
        ).toEqual([]);
    });

    it('rejects negative file sizes', () => {
        expect(
            errorsFor({
                filenames: ['first.bag', 'second.bag'],
                missionUUID: MISSION_UUID,
                fileSizes: [1_000_000, -1_000_000],
            }),
        ).toEqual(['fileSizes']);
    });

    it('rejects more filenames than the per-request limit', () => {
        const filenames = Array.from(
            { length: MAX_FILES_PER_UPLOAD_REQUEST + 1 },
            (_, index) => `file_${index.toString()}.bag`,
        );
        expect(errorsFor({ filenames, missionUUID: MISSION_UUID })).toEqual([
            'filenames',
        ]);
    });

    it('rejects more file sizes than the per-request limit', () => {
        expect(
            errorsFor({
                filenames: ['first.bag'],
                missionUUID: MISSION_UUID,
                fileSizes: Array.from(
                    { length: MAX_FILES_PER_UPLOAD_REQUEST + 1 },
                    () => 1,
                ),
            }),
        ).toEqual(['fileSizes']);
    });
});

describe('FileLifecycleService.getTemporaryAccess credential issuing', () => {
    let events: string[];
    let existingFiles: Partial<FileEntity>[];
    let generateTemporaryCredential: jest.Mock;
    let fileRepositoryUpdate: jest.Mock;
    let service: FileLifecycleService;

    beforeEach(() => {
        events = [];
        existingFiles = [];
        let counter = 0;

        generateTemporaryCredential = jest
            .fn()
            .mockImplementation((uuid: string) => {
                events.push(`sts:${uuid}`);
                return Promise.resolve({ accessKey: uuid });
            });
        fileRepositoryUpdate = jest.fn().mockResolvedValue({});

        const nestedManager = {
            create: jest.fn((_entity: unknown, data: object) => data),
            save: jest.fn((_entity: unknown, data: object) => {
                counter += 1;
                return Promise.resolve({
                    ...data,
                    uuid: `file-${counter.toString()}`,
                });
            }),
        };
        const manager = {
            find: jest.fn(() => Promise.resolve(existingFiles)),
            transaction: jest.fn(
                (callback: (m: typeof nestedManager) => Promise<unknown>) =>
                    callback(nestedManager),
            ),
        };
        const dataSource = {
            transaction: jest.fn(
                async (callback: (m: typeof manager) => Promise<unknown>) => {
                    const result = await callback(manager);
                    events.push('commit');
                    return result;
                },
            ),
        } as unknown as DataSource;

        service = new FileLifecycleService(
            {
                update: fileRepositoryUpdate,
            } as unknown as Repository<FileEntity>,
            {
                findOneOrFail: jest
                    .fn()
                    .mockResolvedValue({ uuid: MISSION_UUID }),
            } as unknown as Repository<MissionEntity>,
            {
                findOneOrFail: jest.fn().mockResolvedValue({ uuid: 'user' }),
            } as unknown as Repository<UserEntity>,
            {} as unknown as Repository<CategoryEntity>,
            { generateTemporaryCredential } as unknown as IStorageBucket,
            dataSource,
            { log: jest.fn() } as unknown as FileAuditService,
            {} as unknown as TriggerService,
            {} as unknown as MissionGuardService,
        );
    });

    it('issues credentials only after the transaction commits', async () => {
        const result = await service.getTemporaryAccess(
            ['first.bag', 'second.bag'],
            MISSION_UUID,
            'user',
        );

        expect(events).toEqual(['commit', 'sts:file-1', 'sts:file-2']);
        expect(result.data.map((entry) => entry.fileUUID)).toEqual([
            'file-1',
            'file-2',
        ]);
    });

    it('issues no credentials when a later file conflicts', async () => {
        existingFiles = [{ filename: 'second.bag', state: FileState.OK }];

        await expect(
            service.getTemporaryAccess(
                ['first.bag', 'second.bag'],
                MISSION_UUID,
                'user',
            ),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(generateTemporaryCredential).not.toHaveBeenCalled();
    });

    it('cancels the reserved files when issuing credentials fails', async () => {
        generateTemporaryCredential.mockRejectedValueOnce(
            new Error('sts down'),
        );

        await expect(
            service.getTemporaryAccess(['first.bag'], MISSION_UUID, 'user'),
        ).rejects.toThrow('sts down');
        expect(fileRepositoryUpdate).toHaveBeenCalledWith(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            { uuid: expect.anything() },
            { state: FileState.CANCELED },
        );
    });
});
