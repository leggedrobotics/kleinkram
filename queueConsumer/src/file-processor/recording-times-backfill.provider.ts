import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import {
    findFilesMissingRecordingTimes,
    RECORDING_TIMES_BACKFILL_JOB,
    recordingTimesBackfillJobOptions,
} from '@kleinkram/backend-common/services/recording-times-backfill';
import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import Redlock from 'redlock';
import { Repository } from 'typeorm';
import logger from '../logger';

/**
 * How many files a single run hands to the queue. Every job reads the index of
 * an object in the storage backend, so the batch is kept small enough that the
 * backfill does not crowd out the ingestion of new uploads; a large backlog is
 * worked off over the following hours instead.
 */
const BATCH_SIZE = 1000;

/**
 * Recovers the recording windows of files that were ingested before the
 * recording times were stored, or while the MCAP extractor still read the
 * recording start from an MCAP header field that does not exist.
 *
 * Files we cannot recover a start date for are picked up again on the next
 * run. That is a handful of unreadable objects at worst, and it means a file
 * that only becomes readable later (a restored object, say) is still fixed.
 */
@Injectable()
export class RecordingTimesBackfillProvider implements OnModuleInit {
    private redlock!: Redlock;

    constructor(
        @InjectRepository(FileEntity)
        private readonly fileRepository: Repository<FileEntity>,
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
    ) {}

    onModuleInit(): void {
        this.redlock = new Redlock([new Redis(redis)], { retryCount: 0 });
    }

    @Cron(CronExpression.EVERY_HOUR)
    async backfillRecordingTimes(): Promise<void> {
        await this.redlock
            .using([`lock:recording-times-backfill`], 10_000, async () => {
                const files = await findFilesMissingRecordingTimes(
                    this.fileRepository,
                    BATCH_SIZE,
                );

                for (const file of files) {
                    await this.fileQueue.add(
                        RECORDING_TIMES_BACKFILL_JOB,
                        { fileUuid: file.uuid },
                        recordingTimesBackfillJobOptions(file.uuid),
                    );
                }

                logger.debug(
                    `Scheduled ${String(files.length)} files for recording time backfill`,
                );
            })
            .catch(() => {
                logger.debug(
                    "Couldn't acquire lock for recording times backfill",
                );
            });
    }
}
