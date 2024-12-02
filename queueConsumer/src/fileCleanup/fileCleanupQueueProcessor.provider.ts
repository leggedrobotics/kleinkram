import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import {
    In,
    IsNull,
    LessThanOrEqual,
    MoreThanOrEqual,
    Not,
    Repository,
} from 'typeorm';
import { Job, Queue } from 'bull';
import {
    AccessGroupRights,
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import QueueEntity from '@common/entities/queue/queue.entity';
import User from '@common/entities/user/user.entity';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import logger from '../logger';
import Redlock from 'redlock';
import { Redis } from 'ioredis';
import { redis, systemUser } from '@common/consts';
import { Cron, CronExpression } from '@nestjs/schedule';
import env from '@common/env';
import { getBucketFromFileType, internalMinio } from '@common/minio_helper';
import crypto from 'crypto';
import { Tag } from 'minio';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider implements OnModuleInit {
    private redlock!: Redlock;

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

    onModuleInit() {
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

                if (file.mission === undefined) {
                    logger.error(
                        `Mission of file ${file.uuid} is undefined, skipping`,
                    );
                    return;
                }

                const queue = await this.queueRepository.findOneOrFail({
                    where: {
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
        await this.redlock
            .using([`lock:hash-repair`], 10000, async () => {
                logger.debug('Fixing file hashes');

                const files = await this.fileRepository.find({
                    where: { hash: IsNull(), state: Not(FileState.LOST) },
                    relations: ['mission', 'mission.project'],
                });
                for (const file of files) {
                    const hash = crypto.createHash('md5');

                    if (file.mission === undefined) {
                        logger.error(
                            `Mission of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

                    if (file.mission.project === undefined) {
                        logger.error(
                            `Project of file ${file.uuid} is undefined, skipping`,
                        );
                        continue;
                    }

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
                        datastream.on('end', () => {
                            file.hash = hash.digest('base64');
                            this.fileRepository
                                .save(file)
                                .then(resolve)
                                .catch((e: unknown) => {
                                    reject(e as Error);
                                });
                        });
                    });
                }
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for hash repair");
            });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async cleanupFailedUploads() {
        await this.redlock
            .using([`lock:cleanup-failed-uploads`], 10000, async () => {
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

                        if (file.mission === undefined) {
                            logger.error(
                                `Mission of file ${file.uuid} is undefined, skipping`,
                            );
                            return;
                        }

                        const queue = await this.queueRepository.findOne({
                            where: {
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
            })
            .catch(() => {
                logger.debug(
                    "Couldn't acquire lock for cleanup failed uploads",
                );
            });
    }

    async dumpFileType(fileType: FileType) {
        // bag files
        const files = await this.fileRepository.find({
            relations: ['mission', 'mission.project'],
            where: { state: FileState.OK, type: fileType },
        });

        const header =
            'filename,file_uuid,mission,project,project_uuid,mission_uuid';
        const csv = files
            .map((file) => {
                if (file.mission === undefined) {
                    logger.error(
                        `Mission of file ${file.uuid} is undefined, skipping`,
                    );
                    return undefined;
                }

                if (file.mission.project === undefined) {
                    logger.error(
                        `Project of file ${file.uuid} is undefined, skipping`,
                    );
                    return undefined;
                }

                return `${file.filename},${file.uuid},${file.mission.name},${file.mission.project.name},${file.mission.project.uuid},${file.mission.uuid}`;
            })
            .filter((line) => line !== undefined);

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
        await this.redlock
            .using([`lock:fs-sync`], 10000, async () => {
                logger.debug('Synchronizing file system');

                const files = await this.fileRepository.find({
                    where: { state: In([FileState.OK, FileState.FOUND]) },
                });
                let count = 0;
                await Promise.all(
                    files.map(async (file) => {
                        const exists = await this.doesFileExist(
                            getBucketFromFileType(file.type),
                            file.uuid,
                        );
                        if (!exists) {
                            count++;
                            file.state = FileState.LOST;
                            logger.error(
                                `File ${file.filename} is missing in minio`,
                            );
                            await this.fileRepository.save(file);
                        }
                    }),
                );
                if (count === 0) {
                    logger.info(
                        'All files from the database are present in the minio storage',
                    );
                } else {
                    logger.info(
                        `${count.toString()} files are missing in the minio storage`,
                    );
                }

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
                            logger.info(
                                `Previously lost file ${file.filename} found`,
                            );
                            await this.fileRepository.save(file);
                        }
                    }),
                );

                // ##################### search for files present in minio but missing in DB #####################
                await this.missingInDB(FileType.BAG);
                await this.missingInDB(FileType.MCAP);
            })
            .catch(() => {
                logger.debug("Couldn't acquire lock for fs sync");
            });
    }

    async missingInDB(fileType: FileType) {
        const bucket = getBucketFromFileType(fileType);
        const minioObjects = internalMinio.listObjects(bucket, ''); // ObjectStream

        const minioObjectNamesSet = new Set<string>(
            await minioObjects.map((obj) => obj.name as string).toArray(),
        ); // Set of UUIDs

        const dbObjects = await this.fileRepository.find({
            where: { type: fileType },
        });
        const dbObjectNames = new Set(dbObjects.map((obj) => obj.uuid));
        const missingObjects = minioObjectNamesSet.difference(dbObjectNames); // Set of UUIDs found in minio but not in DB

        await Promise.all(
            [...missingObjects].map(async (obj) => {
                const tags = (
                    await internalMinio.getObjectTagging(bucket, obj)
                )[0] as unknown as Tag[];
                const missionUUID = tags.find(
                    (tag: Tag) => tag.Key === 'mission_uuid',
                )?.Value;
                const filename = tags.find(
                    (tag: Tag) => tag.Key === 'filename',
                )?.Value;
                const minioObject = await internalMinio.statObject(bucket, obj);

                if (missionUUID === undefined || filename === undefined) {
                    logger.error(
                        `Missing tags in minio object: UUID: ${obj}, has Tags:${tags.map((tag: Tag) => `${tag.Key}:${tag.Value}`).toString()} in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket`,
                    );
                    return;
                }

                const mission = await this.missionRepository.findOne({
                    where: {
                        uuid: missionUUID,
                    },
                });
                if (!mission) {
                    throw new Error(
                        `Mission of file to be recovered not found: mission UUID:${missionUUID}`,
                    );
                }
                const recoverQueue = this.queueRepository.create({
                    identifier: obj,

                    display_name: filename,
                    state: QueueState.AWAITING_PROCESSING,
                    location: FileLocation.MINIO,
                    mission: { uuid: missionUUID },
                    creator: { uuid: systemUser.uuid },
                });

                const fileEntity = this.fileRepository.create({
                    uuid: obj,
                    mission: { uuid: missionUUID },
                    date: new Date(),
                    filename,
                    size: minioObject.size,
                    creator: { uuid: systemUser.uuid },
                    type: fileType,
                    origin: FileOrigin.UNKNOWN,
                });
                try {
                    const queueEntity =
                        await this.queueRepository.save(recoverQueue);

                    await this.fileRepository.save(fileEntity);
                    await this.fileQueue.add('processMinioFile', {
                        queueUuid: queueEntity.uuid,
                        recovering: true,
                    });
                } catch {
                    logger.error(
                        `Failed to recover file ${obj} in mission ${missionUUID}`,
                    );
                }
                logger.error(
                    `Found missing object in minio: UUID: ${obj}, has Tags:${tags.map((tag: Tag) => `${tag.Key}:${tag.Value}`).toString()} in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket`,
                );
            }),
        );
        if (missingObjects.size === 0) {
            logger.info(
                `All Files in ${fileType === FileType.MCAP ? 'MCAP' : 'BAG'} bucket are in the DB`,
            );
        }
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
        if (mission === undefined) {
            logger.error(
                `Mission ${missionUUID} is undefined, skipping cancel upload`,
            );
            return false;
        }

        if (mission.project === undefined) {
            logger.error(
                `Project of mission ${mission.uuid} is undefined, skipping`,
            );
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
        } catch (err: unknown) {
            const errorCode = (err as { code: string }).code;

            if (errorCode === 'NotFound') {
                return false;
            }
            // Handle other potential errors (e.g., network issues)
            throw err;
        }
    }
}
