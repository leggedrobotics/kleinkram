import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import {
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import { Job, Queue } from 'bull';
import {
    AccessGroupRights,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/enum';
import QueueEntity from '@common/entities/queue/queue.entity';
import User from '@common/entities/user/user.entity';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import logger from '../logger';
import Redlock from 'redlock';
import { Redis } from 'ioredis';
import { redis } from '@common/consts';
import { Cron, CronExpression } from '@nestjs/schedule';
import env from '@common/env';
import { getBucketFromFileType, internalMinio } from '@common/minio_helper';
import crypto from 'crypto';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock: Redlock;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
        @InjectQueue('file-queue') private readonly fileQueue: Queue,
    ) {}

    async onModuleInit() {
        const redisClient = new Redis(redis);
        this.redlock = new Redlock([redisClient], {
            retryCount: 0,
            retryDelay: 200, // Time in ms between retries
        });
    }

    @Process({ concurrency: 10, name: 'cancelUpload' })
    async process(job: CancelUploadJob) {
        const userUUID = job.data.userUUID;
        const uuids = job.data.uuids;
        const missionUUID = job.data.missionUUID;
        const canCancelUpload = await this.canCancelUpload(
            userUUID,
            missionUUID,
        );
        if (!canCancelUpload) {
            logger.debug(`User ${userUUID} can't cancel upload`);
            return;
        }
        await Promise.all(
            uuids.map(async (uuid) => {
                const file = await this.fileRepository.findOne({
                    where: { uuid, mission: { uuid: missionUUID } },
                    relations: ['mission'],
                });
                if (!file) {
                    return;
                }
                if (file.state === FileState.OK) {
                    return;
                }
                const queue = await this.queueRepository.findOne({
                    where: {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        display_name: file.filename,
                        mission: { uuid: file.mission.uuid },
                    },
                });
                queue.state = QueueState.CANCELED;
                await this.queueRepository.save(queue);
                await this.fileRepository.remove(file);
                return;
            }),
        );
    }

    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async fixFileHashes() {
        await this.redlock.using([`lock:hash-repair`], 10000, async () => {
            logger.debug('Fixing file hashes');

            const files = await this.fileRepository.find({
                where: { hash: IsNull(), state: Not(FileState.LOST) },
                relations: ['mission', 'mission.project'],
            });
            for (const file of files) {
                const hash = crypto.createHash('md5');

                const datastream = await internalMinio.getObject(
                    file.type === FileType.BAG
                        ? env.MINIO_BAG_BUCKET_NAME
                        : env.MINIO_MCAP_BUCKET_NAME,
                    `${file.mission.project.name}/${file.mission.name}/${file.filename}`,
                );
                await new Promise((resolve, reject) => {
                    datastream.on('error', (err) => {
                        logger.error(err);
                        resolve(void 0);
                    });
                    datastream.on('data', (chunk) => {
                        hash.update(chunk);
                    });
                    datastream.on('end', async () => {
                        file.hash = hash.digest('base64');
                        await this.fileRepository.save(file);
                        resolve(void 0);
                    });
                });
            }
        });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanupFailedUploads() {
        await this.redlock.using(
            [`lock:cleanup-failed-uploads`],
            10000,
            async () => {
                logger.debug('Cleaning up failed uploads');
                const failedUploads = await this.fileRepository.find({
                    where: {
                        state: FileState.UPLOADING,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    failedUploads.map(async (file) => {
                        file.state = FileState.ERROR;
                        await this.fileRepository.save(file);
                        const queue = await this.queueRepository.findOne({
                            where: {
                                // eslint-disable-next-line @typescript-eslint/naming-convention
                                display_name: file.filename,
                                mission: { uuid: file.mission.uuid },
                            },
                        });
                        if (queue) {
                            queue.state = QueueState.ERROR;
                            await this.queueRepository.save(queue);
                        }
                    }),
                );

                // set pending queue entries to error
                const pendingQueues = await this.queueRepository.find({
                    where: {
                        state: QueueState.AWAITING_UPLOAD,
                        updatedAt: LessThanOrEqual(
                            new Date(Date.now() - 1000 * 60 * 60 * 12),
                        ),
                    },
                });
                await Promise.all(
                    pendingQueues.map(async (queue) => {
                        queue.state = QueueState.ERROR;
                        await this.queueRepository.save(queue);
                    }),
                );
            },
        );
    }

    async dumpFileType(fileType: FileType) {
        // bag files
        const files = await this.fileRepository.find({
            relations: ['mission', 'mission.project'],
            where: { state: FileState.OK, type: fileType },
        });

        const header =
            'filename,file_uuid,mission,project,project_uuid,mission_uuid';
        const csv = files.map((file) => {
            return `${file.filename},${file.uuid},${file.mission.name},${file.mission.project.name},${file.mission.project.uuid},${file.mission.uuid}`;
        });

        const csvString = [header, ...csv].join('\n');
        await internalMinio.putObject(
            fileType === FileType.BAG
                ? env.MINIO_BAG_BUCKET_NAME
                : env.MINIO_MCAP_BUCKET_NAME,
            'file_names.csv',
            csvString,
        );
    }

    /**
     * Dump an CSV containing the resolution of the file names
     * (file name, file uuid, mission name, project name, project uuid, mission uuid)
     */
    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async createFileNameDump() {
        await this.dumpFileType(FileType.BAG);
        await this.dumpFileType(FileType.MCAP);
    }

    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async synchronizeFileSystem() {
        await this.redlock.using([`lock:fs-sync`], 10000, async () => {
            logger.debug('Synchronizing file system');

            const files = await this.fileRepository.find({
                where: { state: FileState.OK },
            });

            await Promise.all(
                files.map(async (file) => {
                    const exists = await this.doesFileExist(
                        getBucketFromFileType(file.type),
                        file.uuid,
                    );
                    if (!exists) {
                        file.state = FileState.LOST;
                        await this.fileRepository.save(file);
                    }
                }),
            );

            // search for lost files
            const lostFiles = await this.fileRepository.find({
                where: { state: FileState.LOST },
            });

            await Promise.all(
                lostFiles.map(async (file) => {
                    const exists = await this.doesFileExist(
                        getBucketFromFileType(file.type),
                        file.uuid,
                    );
                    if (exists) {
                        file.state = FileState.FOUND;
                        await this.fileRepository.save(file);
                    }
                }),
            );

            // search for files present in minio but missing in DB
            const minioObjects = internalMinio.listObjects(
                env.MINIO_BAG_BUCKET_NAME,
                '',
            );
            const dbObjects = await this.fileRepository.find({
                where: { type: FileType.BAG },
            });

            const minioObjectNames = minioObjects.map((obj) => obj.name);
            const dbObjectNames = dbObjects.map((obj) => obj.uuid);
            const missingObjects = minioObjectNames.filter(
                (obj) => !dbObjectNames.includes(obj),
            );

            missingObjects.forEach((obj) => {
                logger.error(
                    `Found missing object in minio: ${obj} in BAG bucket`,
                );
            });

            // search for files present in minio but missing in DB
            const minioObjectsMcap = internalMinio.listObjects(
                env.MINIO_MCAP_BUCKET_NAME,
                '',
            );
            const dbObjectsMcap = await this.fileRepository.find({
                where: { type: FileType.MCAP },
            });

            const minioObjectNamesMcap = minioObjectsMcap.map(
                (obj) => obj.name,
            );
            const dbObjectNamesMcap = dbObjectsMcap.map((obj) => obj.uuid);
            const missingObjectsMcap = minioObjectNamesMcap.filter(
                (obj) => !dbObjectNamesMcap.includes(obj),
            );

            missingObjectsMcap.forEach((obj) => {
                logger.error(
                    `Found missing object in minio: ${obj} in MCAP bucket`,
                );
            });
        });
    }

    async canCancelUpload(userUUID: string, missionUUID: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (!mission) {
            return false;
        }

        const canAccessProject = await this.projectAccessView.exists({
            where: {
                projectUUID: mission.project.uuid,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
        if (canAccessProject) {
            return true;
        }
        return await this.missionAccessView.exists({
            where: {
                missionUUID,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }

    async doesFileExist(
        bucketName: string,
        objectName: string,
    ): Promise<boolean> {
        try {
            await internalMinio.statObject(bucketName, objectName);
            return true;
        } catch (err) {
            if (err.code === 'NotFound') {
                return false;
            }
            // Handle other potential errors (e.g., network issues)
            throw err;
        }
    }
}
