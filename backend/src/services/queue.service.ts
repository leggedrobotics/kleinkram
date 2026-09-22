import { addAccessConstraints } from '@/endpoints/auth/auth-helper';
import {
    CancelProcessingResponseDto,
    DeleteMissionResponseDto,
    DriveCreate,
} from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';
import {
    findFilesMissingRecordingTimes,
    RECORDING_TIMES_BACKFILL_JOB,
    recordingTimesBackfillJobOptions,
} from '@kleinkram/backend-common/services/recording-times-backfill';
import {
    FileEventType,
    FileLocation,
    FileOrigin,
    FileSource,
    FileState,
    FileType,
    QueueState,
    TriggerEvent,
    UserRole,
} from '@kleinkram/shared';
import { getGoogleDriveInfo } from '@kleinkram/validation';
import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import Queue from 'bull';
import * as fs from 'node:fs';
import { Gauge } from 'prom-client';
import { FindOptionsWhere, In, IsNull, MoreThan, Repository } from 'typeorm';
import logger from '../logger';
import { TriggerService } from './trigger.service';
import { UserService } from './user.service';

/**
 * Upper bound of files a single manual backfill run queues, so that a click
 * cannot enqueue a million storage reads at once.
 */
const RECORDING_TIMES_BACKFILL_BATCH_SIZE = 2000;

/**
 * How long a staged upload may sit around before it is treated as abandoned.
 * Comfortably longer than the longest upload credential, so an upload that is
 * still in flight can never be collected.
 */
const STAGED_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class QueueService implements OnModuleInit {
    private fileQueue!: Queue.Queue;

    constructor(
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private userService: UserService,
        private readonly auditService: FileAuditService,

        // Metrics for File Queue
        @InjectMetric('backend_pending_jobs')
        private pendingJobs: Gauge,
        @InjectMetric('backend_active_jobs')
        private activeJobs: Gauge,
        @InjectMetric('backend_completed_jobs')
        private completedJobs: Gauge,
        @InjectMetric('backend_failed_jobs')
        private failedJobs: Gauge,
        private readonly triggerService: TriggerService,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
    ) {}

    onModuleInit(): void {
        this.fileQueue = new Queue('file-queue', { redis });
        logger.debug('File Queue initialized');
    }

    async importFromDrive(
        driveCreate: DriveCreate,
        user: UserEntity,
    ): Promise<void> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.userService.findOneByUUID(user.uuid, {}, {});

        const { id: fileId, isFolder } = getGoogleDriveInfo(
            driveCreate.driveURL,
        );
        if (fileId === null) throw new ConflictException('Invalid Drive URL');

        if (
            isFolder && // Check if backend has Service Account Key configured
            // We use fs.existsSync to be robust
            (!env.GOOGLE_KEY_FILE ||
                !fs.existsSync(env.GOOGLE_KEY_FILE) ||
                !fs.statSync(env.GOOGLE_KEY_FILE).isFile())
        ) {
            throw new BadRequestException(
                'Google Drive Folder ingestion requires a configured Service Account on the server.',
            );
        }

        const queueEntry = await this.queueRepository.save(
            this.queueRepository.create({
                identifier: fileId,
                displayName: `Google Drive File (${fileId})`,
                state: QueueState.AWAITING_PROCESSING,
                location: FileLocation.DRIVE,
                mission,
                creator,
            }),
        );

        await this.fileQueue
            .add('processDriveFile', { queueUuid: queueEntry.uuid })
            .catch((error: unknown) => logger.error(error));

        logger.debug('Added drive file to queue');
    }

    async recalculateHashes(): Promise<{
        success: boolean;
        fileCount: number;
    }> {
        const files = await this.fileRepository.find({
            where: [
                { hash: IsNull(), state: FileState.OK },
                { hash: '', state: FileState.OK },
            ],
            relations: {
                mission: {
                    project: true,
                },
            },
        });

        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger.debug(`Add ${files.length} files to queue for hash calculation`);

        for (const file of files) {
            try {
                await this.fileQueue.add('extractHashFromS3', {
                    fileUuid: file.uuid,
                });
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } catch (error: any) {
                logger.error(error);
            }
        }

        return { success: true, fileCount: files.length };
    }

    /**
     * Queues the recovery of the recording window for files that do not know
     * theirs yet. The nightly job in the queue consumer does the same; this is
     * the manual trigger for when a fix should not wait for the night.
     */
    async backfillRecordingTimes(): Promise<{
        success: boolean;
        fileCount: number;
    }> {
        const files = await findFilesMissingRecordingTimes(
            this.fileRepository,
            RECORDING_TIMES_BACKFILL_BATCH_SIZE,
        );

        logger.debug(
            `Add ${files.length.toString()} files to queue for recording time backfill`,
        );

        for (const file of files) {
            try {
                await this.fileQueue.add(
                    RECORDING_TIMES_BACKFILL_JOB,
                    { fileUuid: file.uuid },
                    recordingTimesBackfillJobOptions(file.uuid),
                );
            } catch (error: unknown) {
                logger.error(error);
            }
        }

        return { success: true, fileCount: files.length };
    }

    /**
     * Moves a confirmed upload off the key the uploader has credentials for
     * and onto the key the file is served from.
     *
     * The credentials handed to a client allow `PutObject` on the staging key
     * for as long as they are valid, and SeaweedFS issues them as stateless
     * JWTs that cannot be revoked. Promoting the object is therefore what ends
     * the client's write access: everything downstream - the hash stored here,
     * the magic number check and the metadata extracted by the queue consumer
     * - describes bytes that can no longer change.
     *
     * @param file - the file whose upload was confirmed
     */
    private async promoteUpload(file: FileEntity): Promise<void> {
        const storageKey = file.storageUuid;
        const staged = await this.dataStorage.getStagedFileInfo(storageKey);

        if (!staged) {
            // Nothing staged: either this confirm is a retry of one that
            // already promoted the object, or the upload came from a client
            // old enough to write straight to the served key.
            return;
        }

        const alreadyPromoted = await this.dataStorage.getFileInfo(storageKey);
        if (alreadyPromoted) {
            // The object was promoted by an earlier confirm, so these bytes
            // were written to the staging key afterwards - which is exactly
            // the overwrite the promotion exists to prevent. They are
            // discarded, and loudly: a client has no reason to do this.
            logger.error(
                `SECURITY: discarding ${staged.size.toString()} bytes written to the staging key ` +
                    `of ${storageKey} after its upload was already confirmed`,
            );
            await this.dataStorage
                .deleteStagedFile(storageKey)
                .catch(logger.log);
            return;
        }

        await this.dataStorage.promoteStagedFile(storageKey);
        logger.debug(`Promoted upload ${storageKey} out of the staging prefix`);
    }

    /**
     * Deletes uploads that were staged but never confirmed.
     *
     * Upload credentials live for at most four hours, so anything that has
     * sat in the staging prefix for a day belongs to an upload that can no
     * longer be completed - either abandoned, or written by a client trying
     * to replace a file that was already promoted.
     */
    @Cron(CronExpression.EVERY_DAY_AT_4AM)
    async cleanupStagedUploads(): Promise<void> {
        const cutoff = new Date(Date.now() - STAGED_UPLOAD_MAX_AGE_MS);
        const abandoned = await this.dataStorage
            .listStagedFiles(cutoff)
            .catch((error: unknown) => {
                logger.error(`Failed to list staged uploads: ${String(error)}`);
                return [];
            });

        for (const storageKey of abandoned) {
            await this.dataStorage
                .deleteStagedFile(storageKey)
                .catch((error: unknown) => {
                    logger.error(
                        `Failed to delete staged upload ${storageKey}: ${String(error)}`,
                    );
                });
        }

        if (abandoned.length > 0)
            logger.debug(
                `Removed ${abandoned.length.toString()} abandoned staged upload(s)`,
            );
    }

    async confirmUpload(
        uuid: string,
        md5: string,
        actor: UserEntity,
        source: FileSource | string = FileSource.WEB_INTERFACE,
    ): Promise<void> {
        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: {
                mission: {
                    project: true,
                },
            },
        });

        if (file.state === FileState.CANCELED) {
            throw new ConflictException('Cannot confirm a canceled upload');
        }

        let job = await this.queueRepository.findOne({
            where: { identifier: uuid },
            relations: {
                mission: {
                    project: true,
                },
            },
        });

        job ??= await this.queueRepository.save(
            this.queueRepository.create({
                identifier: file.uuid,
                displayName: file.filename,
                state: QueueState.AWAITING_UPLOAD,
                location: FileLocation.S3,
                mission: file.mission,
                creator: actor,
            } as IngestionJobEntity),
        );

        if (
            job.state !== QueueState.AWAITING_UPLOAD &&
            job.state !== QueueState.ERROR
        ) {
            if (job.state >= QueueState.PROCESSING) return;
            logger.warn(
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                `Resuming upload for job ${job.uuid} in state ${job.state} `,
            );
        }

        await this.promoteUpload(file);

        const fileInfo = await this.dataStorage
            .getFileInfo(file.storageUuid)
            .catch((error: unknown): void => {
                logger.error(
                    `Error in getFileInfo for ${file.uuid}: ${error instanceof Error ? error.message : String(error)}`,
                    error,
                );
                throw new ConflictException('File not found in storage');
            });

        if (!fileInfo) {
            logger.error(`getFileInfo returned undefined for ${file.uuid}`);
            throw new Error('File not found in storage');
        }

        if (file.state === FileState.UPLOADING) file.state = FileState.OK;
        file.size = fileInfo.size;
        file.hash = md5;
        await this.fileRepository.save(file);

        job.state = QueueState.AWAITING_PROCESSING;
        await this.queueRepository.save(job);

        await this.fileQueue.add('processS3File', {
            queueUuid: job.uuid,
            md5,
        });

        logger.debug(`Confirmed upload for ${uuid}, job ${job.uuid} queued.`);

        await this.auditService.log(
            FileEventType.UPLOAD_COMPLETED,
            {
                fileUuid: file.uuid,
                filename: file.filename,
                ...(job.mission?.uuid ? { missionUuid: job.mission.uuid } : {}),
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                ...(actor ? { actor } : {}),
                details: { origin: FileOrigin.UPLOAD, source },
            },
            true,
        );

        await this.triggerService.addFileEvent(file.uuid, TriggerEvent.UPLOAD);
    }

    async active(
        startDate: Date,
        stateFilter: string,
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<IngestionJobEntity[]> {
        // @ts-ignore
        const user = await this.userService.findOneByUUID(userUUID);
        const where: FindOptionsWhere<IngestionJobEntity> = {
            updatedAt: MoreThan(startDate),
        };

        if (user.role === UserRole.ADMIN) {
            if (stateFilter) {
                const filter = stateFilter
                    .split(',')
                    .map((state) => Number.parseInt(state));
                where.state = In(filter);
            }
            return await this.queueRepository.find({
                where,
                relations: {
                    mission: {
                        project: true,
                    },

                    creator: true,
                },
                skip,
                take,
                order: { createdAt: 'DESC' },
            });
        }

        const query = addAccessConstraints(
            this.queueRepository
                .createQueryBuilder('ingestion_job')
                .leftJoinAndSelect('ingestion_job.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('ingestion_job.creator', 'creator')
                .where('ingestion_job.updatedAt > :startDate', { startDate }),
            userUUID,
        )
            .skip(skip)
            .take(take)
            .orderBy('ingestion_job.createdAt', 'DESC');

        if (stateFilter) {
            const filter = stateFilter
                .split(',')
                .map((state) => Number.parseInt(state));
            query.andWhere('ingestion_job.state IN (:...filter)', { filter });
        }
        return (await query.getMany()) as IngestionJobEntity[];
    }

    async delete(
        missionUUID: string,
        queueUUID: string,
    ): Promise<DeleteMissionResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: {
                mission: {
                    project: true,
                },
            },
        });

        if (
            queue.state >= QueueState.PROCESSING &&
            queue.state < QueueState.COMPLETED
        ) {
            throw new ConflictException('Cannot delete file while processing');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        await this.queueRepository.remove(queue);

        const file = await this.fileRepository.findOne({
            where: { uuid: queue.identifier, mission: { uuid: missionUUID } },
        });

        if (file) {
            await this.dataStorage
                .deleteFile(file.storageUuid)
                .catch(logger.log);
            // An upload that was never confirmed still sits in the staging
            // prefix; the nightly cleanup would collect it eventually, but a
            // deleted file should not keep occupying space until then.
            await this.dataStorage
                .deleteStagedFile(file.storageUuid)
                .catch(logger.log);
            await this.fileRepository.remove(file);

            if (file.type === FileType.BAG) {
                const mcap = await this.fileRepository.findOne({
                    where: {
                        uuid: queue.identifier,
                        mission: { uuid: missionUUID },
                    },
                });
                if (mcap) {
                    await this.dataStorage
                        .deleteFile(mcap.uuid)
                        .catch(logger.log);
                    await this.fileRepository.remove(mcap);
                }
            }
        }
        return { success: true };
    }

    async cancelProcessing(
        queueUUID: string,
        missionUUID: string,
    ): Promise<CancelProcessingResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: {
                mission: {
                    project: true,
                },
            },
        });

        if (queue.state >= QueueState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        queue.state = QueueState.CANCELED;
        await this.queueRepository.save(queue);

        return {};
    }

    async stopJob(queueUUID: string): Promise<void> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID },
        });

        // We can only stop active jobs
        if (queue.state !== QueueState.PROCESSING) {
            throw new ConflictException('Job is not processing');
        }

        // To stop a job we need to find the active job in the queue
        const activeJobs = await this.fileQueue.getActive();
        const jobToStop = activeJobs.find(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            (job) => job.data.queueUuid === queueUUID,
        );

        if (jobToStop) {
            // This moves the job to failed
            await jobToStop.moveToFailed({ message: 'Stopped by user' });
            queue.state = QueueState.ERROR;
            await this.queueRepository.save(queue);
        } else {
            throw new ConflictException(
                'Job not found in active queue, state might be desynced',
            );
        }
    }

    /**
     * Updates Prometheus metrics for File Queue
     */
    @Cron(CronExpression.EVERY_SECOND)
    async checkQueueState(): Promise<void> {
        const jobsCount = await this.fileQueue.getJobCounts();
        const label = { queue: 'fileQueue' };

        this.pendingJobs.set(label, jobsCount.waiting + jobsCount.delayed);
        this.activeJobs.set(label, jobsCount.active);
        this.completedJobs.set(label, jobsCount.completed);
        this.failedJobs.set(label, jobsCount.failed);
    }
}

export default QueueService;
