import {
    CancelProcessingResponseDto,
    DeleteMissionResponseDto,
    DriveCreate,
    UpdateTagTypeDto,
} from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { redis } from '@kleinkram/backend-common/consts';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import {
    FileEventType,
    FileLocation,
    FileOrigin,
    FileSource,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@kleinkram/shared';
import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import Queue from 'bull';
import { Gauge } from 'prom-client';
import { FindOptionsWhere, In, IsNull, MoreThan, Repository } from 'typeorm';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import logger from '../logger';
import { UserService } from './user.service';

function extractFileIdFromUrl(url: string): string | undefined {
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;
    let match = filePattern.exec(url);
    if (match?.[1]) return match[1];
    match = folderPattern.exec(url);
    if (match?.[1]) return match[1];
    return undefined;
}

@Injectable()
class QueueService implements OnModuleInit {
    private fileQueue!: Queue.Queue;

    constructor(
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private userService: UserService,
        private readonly storageService: StorageService,
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
    ) {}

    onModuleInit(): void {
        this.fileQueue = new Queue('file-queue', { redis });
        logger.debug('File Queue initialized');
    }

    async importFromDrive(
        driveCreate: DriveCreate,
        user: UserEntity,
    ): Promise<UpdateTagTypeDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.userService.findOneByUUID(user.uuid, {}, {});

        const fileId = extractFileIdFromUrl(driveCreate.driveURL);
        if (fileId === undefined)
            throw new ConflictException('Invalid Drive URL');

        const queueEntry = await this.queueRepository.save(
            this.queueRepository.create({
                identifier: fileId,
                display_name: `GoogleDrive Object (no id=${fileId})`,
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
        return {};
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
            relations: ['mission', 'mission.project'],
        });

        logger.debug(`Add ${files.length} files to queue for hash calculation`);

        for (const file of files) {
            try {
                await this.fileQueue.add('extractHashFromMinio', {
                    file_uuid: file.uuid,
                });
            } catch (error: any) {
                logger.error(error);
            }
        }

        return { success: true, fileCount: files.length };
    }

    async confirmUpload(
        uuid: string,
        md5: string,
        actor: UserEntity,
        source: FileSource | string = FileSource.WEB_INTERFACE,
    ): Promise<void> {
        let job = await this.queueRepository.findOne({
            where: { identifier: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (!job) {
            logger.warn(
                `confirmUpload: Job missing for file ${uuid}. Recreating...`,
            );

            const file = await this.fileRepository.findOneOrFail({
                where: { uuid },
                relations: ['mission', 'mission.project'],
            });

            job = await this.queueRepository.save(
                this.queueRepository.create({
                    identifier: file.uuid,
                    display_name: file.filename,
                    state: QueueState.AWAITING_UPLOAD,
                    location: FileLocation.MINIO,
                    mission: file.mission,
                    creator: actor,
                } as IngestionJobEntity),
            );
        }

        if (
            job.state !== QueueState.AWAITING_UPLOAD &&
            job.state !== QueueState.ERROR
        ) {
            if (job.state >= QueueState.PROCESSING) return;
            logger.warn(
                `Resuming upload for job ${job.uuid} in state ${job.state}`,
            );
        }

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        const fileInfo = await this.storageService
            .getFileInfo(env.MINIO_DATA_BUCKET_NAME, file.uuid)
            .catch((): void => {
                throw new ConflictException('File not found in Minio');
            });

        if (!fileInfo) throw new Error('File not found in Minio');

        if (file.state === FileState.UPLOADING) file.state = FileState.OK;
        file.size = fileInfo.size;
        file.hash = md5;
        await this.fileRepository.save(file);

        job.state = QueueState.AWAITING_PROCESSING;
        await this.queueRepository.save(job);

        await this.fileQueue.add('processMinioFile', {
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
                ...(actor ? { actor } : {}),
                details: { origin: FileOrigin.UPLOAD, source },
            },
            true,
        );
    }

    async active(
        startDate: Date,
        stateFilter: string,
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<any[]> {
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
                relations: ['mission', 'mission.project', 'creator'],
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
        return query.getMany();
    }

    async delete(
        missionUUID: string,
        queueUUID: string,
    ): Promise<DeleteMissionResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });

        if (
            queue.state >= QueueState.PROCESSING &&
            queue.state < QueueState.COMPLETED
        ) {
            throw new ConflictException('Cannot delete file while processing');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        await this.queueRepository.remove(queue);

        const file = await this.fileRepository.findOne({
            where: { uuid: queue.identifier, mission: { uuid: missionUUID } },
        });

        if (file) {
            await this.storageService
                .deleteFile(env.MINIO_DATA_BUCKET_NAME, file.uuid)
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
                    await this.storageService
                        .deleteFile(env.MINIO_DATA_BUCKET_NAME, mcap.uuid)
                        .catch(logger.log);
                    await this.fileRepository.remove(mcap);
                }
            }
        }
        return {};
    }

    async cancelProcessing(
        queueUUID: string,
        missionUUID: string,
    ): Promise<CancelProcessingResponseDto> {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID, mission: { uuid: missionUUID } },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state >= QueueState.PROCESSING) {
            throw new ConflictException('File is not in processing state');
        }

        const waitingJobs = await this.fileQueue.getWaiting();
        const jobToRemove = waitingJobs.find(
            (job) => job.data.queueUuid === queueUUID,
        );
        if (jobToRemove) await jobToRemove.remove();

        queue.state = QueueState.CANCELED;
        await this.queueRepository.save(queue);

        return {};
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
