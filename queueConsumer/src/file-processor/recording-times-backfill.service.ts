import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import { FileType } from '@kleinkram/shared';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as fsPromises from 'node:fs/promises';
import path from 'node:path';
import { IsNull, Not, Repository } from 'typeorm';
import logger from '../logger';
import { applyRecordingTimes } from './handlers/abstract-metadata.service';
import { Db3MetadataService } from './handlers/db3-metadata.service';
import { McapMetadataService } from './handlers/mcap-metadata.service';
import { RosBagMetadataService } from './handlers/rosbag-metadata.service';
import { RecordingTimes } from './handlers/time';

const PRESIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Recovers `recordingStartDate` / `recordingEndDate` for files that were
 * ingested before those columns existed, or while the MCAP extractor still
 * looked for the recording start in a header field that does not exist (which
 * silently left every MCAP with its upload time as start date).
 */
@Injectable()
export class RecordingTimesBackfillService {
    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepo: Repository<FileEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly mcapMetadataService: McapMetadataService,
        private readonly rosBagMetadataService: RosBagMetadataService,
        private readonly db3MetadataService: Db3MetadataService,
    ) {}

    /**
     * Fills in the recording window of a single file.
     *
     * @returns whether the file now has a recording start.
     */
    async backfillFile(fileUuid: string): Promise<boolean> {
        const file = await this.fileRepo.findOne({
            where: { uuid: fileUuid },
        });

        if (!file) {
            logger.warn(`[Backfill] File ${fileUuid} not found, skipping.`);
            return false;
        }

        if (file.recordingStartDate) return true;

        const recordingTimes =
            (await this.inheritFromRelatedFile(file)) ??
            (await this.probeRecordingTimes(file));

        if (!recordingTimes?.startDate) {
            logger.debug(
                `[Backfill] No recording start found for ${file.filename} (${fileUuid})`,
            );
            return false;
        }

        applyRecordingTimes(file, recordingTimes);
        await this.fileRepo.save(file);

        logger.debug(
            `[Backfill] Recovered recording window of ${file.filename} (${fileUuid})`,
        );

        return true;
    }

    /**
     * A converted file and its source hold the same messages, so a relative
     * that already knows its window spares us reading the object at all.
     */
    private async inheritFromRelatedFile(
        file: FileEntity,
    ): Promise<RecordingTimes | undefined> {
        const related = await this.fileRepo.findOne({
            select: {
                uuid: true,
                recordingStartDate: true,
                recordingEndDate: true,
            },
            where: [
                // the file this one was converted from
                {
                    derivedFiles: { uuid: file.uuid },
                    recordingStartDate: Not(IsNull()),
                },
                // a file that was converted from this one
                {
                    parent: { uuid: file.uuid },
                    recordingStartDate: Not(IsNull()),
                },
            ],
        });

        if (!related?.recordingStartDate) return undefined;

        return {
            startDate: related.recordingStartDate,
            ...(related.recordingEndDate
                ? { endDate: related.recordingEndDate }
                : {}),
        };
    }

    private async probeRecordingTimes(
        file: FileEntity,
    ): Promise<RecordingTimes | undefined> {
        try {
            switch (file.type) {
                case FileType.MCAP: {
                    return await this.mcapMetadataService.probeRecordingTimesFromUrl(
                        await this.presignedUrl(file),
                    );
                }
                case FileType.BAG: {
                    return await this.rosBagMetadataService.probeRecordingTimesFromUrl(
                        await this.presignedUrl(file),
                    );
                }
                case FileType.DB3: {
                    return await this.probeDb3(file);
                }
                default: {
                    return undefined;
                }
            }
        } catch (error: unknown) {
            logger.error(
                `[Backfill] Failed to read recording times of ${file.filename} (${file.uuid}): ${String(error)}`,
            );
            return undefined;
        }
    }

    /**
     * sqlite cannot be read over range requests, so db3 files have to be
     * pulled down in full before they can be inspected.
     */
    private async probeDb3(file: FileEntity): Promise<RecordingTimes> {
        const workDirectory = await fsPromises.mkdtemp(
            path.join('/tmp', 'recording-times-'),
        );
        const localPath = path.join(workDirectory, `${file.uuid}.db3`);

        try {
            await this.dataStorage.downloadFile(file.uuid, localPath);
            return this.db3MetadataService.probeRecordingTimesFromLocalFile(
                localPath,
            );
        } finally {
            await fsPromises.rm(workDirectory, {
                recursive: true,
                force: true,
            });
        }
    }

    private async presignedUrl(file: FileEntity): Promise<string> {
        return this.dataStorage.getInternalPresignedDownloadUrl(
            file.uuid,
            PRESIGNED_URL_TTL_SECONDS,
        );
    }
}
