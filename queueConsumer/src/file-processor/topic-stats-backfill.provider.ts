import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import environment from '@kleinkram/backend-common/environment';
import {
    findFilesNeedingTopicStats,
    TOPIC_STATS_BACKFILL_JOB,
    topicStatsBackfillJobOptions,
} from '@kleinkram/backend-common/services/topic-stats-backfill';
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
 * backfill does not crowd out the ingestion of new uploads.
 */
const BATCH_SIZE = 1000;

/**
 * Fills in the per-topic statistics of files ingested before they were
 * stored, or with an older {@link TOPIC_STATS_VERSION}.
 *
 * Off unless `TOPIC_STATS_BACKFILL=true`, so it can be enabled on one
 * deployment before the next.
 */
@Injectable()
export class TopicStatsBackfillProvider implements OnModuleInit {
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
    async backfillTopicStats(): Promise<void> {
        if (!environment.TOPIC_STATS_BACKFILL) return;

        await this.redlock
            .using([`lock:topic-stats-backfill`], 10_000, async () => {
                const files = await findFilesNeedingTopicStats(
                    this.fileRepository,
                    BATCH_SIZE,
                );

                for (const file of files) {
                    await this.fileQueue.add(
                        TOPIC_STATS_BACKFILL_JOB,
                        { fileUuid: file.uuid },
                        topicStatsBackfillJobOptions(file.uuid),
                    );
                }

                logger.debug(
                    `Scheduled ${String(files.length)} files for topic stats backfill`,
                );
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for topic stats backfill");
            });
    }
}
