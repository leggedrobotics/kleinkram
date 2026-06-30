import { TriggerService } from '@/services/trigger.service';
import { TemporaryFileAccessesDto, UpdateFile } from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import env from '@kleinkram/backend-common/environment';
import {
    IStorageBucket,
    StorageCredentials,
} from '@kleinkram/backend-common/modules/storage/types';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import {
    AccessGroupRights,
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
    TriggerEvent,
    UserRole,
} from '@kleinkram/shared';
import {
    BadRequestException,
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
    OnModuleInit,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Queue from 'bull';
import {
    DataSource,
    In,
    MoreThan,
    MoreThanOrEqual,
    QueryFailedError,
    Repository,
} from 'typeorm';
import logger from '../logger';

const FILE_EXTENSION_TO_FILE_TYPE_MAP: ReadonlyMap<string, FileType> = new Map([
    ['.bag', FileType.BAG],
    ['.mcap', FileType.MCAP],
    ['.yaml', FileType.YAML],
    ['.yml', FileType.YAML],
    ['.svo2', FileType.SVO2],
    ['.tum', FileType.TUM],
    ['.db3', FileType.DB3],
]);

@Injectable()
export class FileLifecycleService implements OnModuleInit {
    private fileCleanupQueue!: Queue.Queue;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(CategoryEntity)
        private categoryRepository: Repository<CategoryEntity>,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly dataSource: DataSource,
        private readonly auditService: FileAuditService,
        private readonly triggerService: TriggerService,
    ) {}

    onModuleInit(): void {
        this.fileCleanupQueue = new Queue('file-cleanup', {
            redis,
        });
    }

    async update(
        uuid: string,
        file: UpdateFile,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<FileEntity | null> {
        logger.debug(`Updating file with uuid: ${uuid}`);

        const databaseFile = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: { mission: { project: true } },
        });

        if (!databaseFile.mission) throw new Error('Mission not found!');
        if (!databaseFile.mission.project)
            throw new Error('Project not found!');

        const oldFilename = databaseFile.filename;
        const isRenamed = file.filename !== oldFilename;

        // validate file ending
        const validExtensions = [...FILE_EXTENSION_TO_FILE_TYPE_MAP.entries()]
            .filter(([, type]) => type === databaseFile.type)
            .map(([extension]) => extension);

        if (
            !validExtensions.some((extension) =>
                file.filename.endsWith(extension),
            )
        ) {
            throw new BadRequestException(
                `File ending must be one of: ${validExtensions.join(', ')}`,
            );
        }

        databaseFile.filename = file.filename;
        databaseFile.date = file.date;

        // Handle Mission Move via Update
        let oldMissionUuid: string | undefined;
        if (
            file.missionUuid &&
            file.missionUuid !== databaseFile.mission.uuid
        ) {
            oldMissionUuid = databaseFile.mission.uuid;
            const newMission = await this.missionRepository.findOneOrFail({
                where: { uuid: file.missionUuid },
                relations: ['project'],
            });
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (newMission) databaseFile.mission = newMission;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (file.categories) {
            databaseFile.categories = await this.categoryRepository.find({
                where: { uuid: In(file.categories) },
            });
        }

        await this.dataSource
            .transaction(async (transactionalEntityManager) => {
                // [Existing Transaction Logic]
                await transactionalEntityManager.save(FileEntity, databaseFile);
            })
            .catch((error: unknown) => {
                // [Existing Error Handling]
                throw error;
            });

        // Log Rename Event
        if (isRenamed) {
            await this.auditService.log(
                FileEventType.RENAMED,
                {
                    fileUuid: databaseFile.uuid,
                    filename: databaseFile.filename,
                    missionUuid: databaseFile.mission.uuid,
                    ...(actor ? { actor } : {}),
                    ...(action ? { action } : {}),
                    details: { oldFilename, newFilename: file.filename },
                },
                true,
            );
            await this.triggerService.addFileEvent(
                databaseFile.uuid,
                TriggerEvent.RENAME,
            );
        }

        // Log Move Event (if done via update)
        if (oldMissionUuid) {
            await this.auditService.log(
                FileEventType.MOVED,
                {
                    fileUuid: databaseFile.uuid,
                    filename: databaseFile.filename,
                    missionUuid: databaseFile.mission.uuid,
                    ...(actor ? { actor } : {}),
                    details: {
                        fromMission: oldMissionUuid,
                        toMission: file.missionUuid,
                    },
                },
                true,
            );
            await this.triggerService.addFileEvent(
                databaseFile.uuid,
                TriggerEvent.MOVE,
            );
        }

        await this.dataStorage.addTags(databaseFile.uuid, {
            // @ts-expect-error
            projectUuid: databaseFile.mission.project.uuid,
            missionUuid: databaseFile.mission.uuid,
            filename: databaseFile.filename,
        });
        return this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
    }

    async moveFiles(
        fileUUIDs: string[],
        missionUUID: string,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<void> {
        await Promise.all(
            fileUUIDs.map(async (uuid) => {
                try {
                    const file = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                        relations: ['mission'],
                    });

                    const oldMissionUuid = file.mission?.uuid;

                    file.mission = { uuid: missionUUID } as MissionEntity;
                    await this.fileRepository.save(file);

                    // Log Move Event
                    await this.auditService.log(
                        FileEventType.MOVED,
                        {
                            fileUuid: uuid,
                            filename: file.filename,
                            missionUuid: missionUUID,
                            ...(actor ? { actor } : {}),
                            ...(action ? { action } : {}),
                            details: {
                                fromMission: oldMissionUuid,
                                toMission: missionUUID,
                            },
                        },
                        true,
                    );
                    await this.triggerService.addFileEvent(
                        uuid,
                        TriggerEvent.MOVE,
                    );

                    // ... [Existing Tag Update Logic] ...
                    const newFile = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                        relations: ['mission', 'mission.project'],
                    });
                    await this.dataStorage.addTags(file.uuid, {
                        filename: file.filename,
                        missionUuid: missionUUID,
                        projectUuid: newFile.mission?.project?.uuid ?? '',
                    });
                } catch (error) {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    logger.error(`Error moving file ${uuid}: ${error}`);
                }
            }),
        );
    }

    async deleteFile(
        uuid: string,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<void> {
        if (!uuid) throw new BadRequestException('UUID is required');

        logger.debug(`Deleting file with uuid: ${uuid}`);

        const file = await this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission'],
        });

        if (file) {
            await this.auditService.log(
                FileEventType.DELETED,
                {
                    fileUuid: uuid,
                    filename: file.filename,
                    missionUuid: file.mission?.uuid ?? '',
                    ...(actor ? { actor } : {}),
                    ...(action ? { action } : {}),
                    details: { snapshot: 'File deleted from DB and Storage' },
                },
                true,
            );
        }

        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // [Existing Deletion Logic]
                const fileToDelete =
                    await transactionalEntityManager.findOneOrFail(FileEntity, {
                        where: { uuid },
                    });
                await this.dataStorage
                    .deleteFile(fileToDelete.uuid)
                    .catch(() => {
                        logger.error(
                            `File ${fileToDelete.uuid} not found in storage, deleting from database only!`,
                        );
                    });

                await transactionalEntityManager.softRemove(fileToDelete);
            },
        );

        logger.debug(`File with uuid ${uuid} deleted`);
    }

    async isUploading(userUUID: string): Promise<boolean> {
        return this.fileRepository
            .findOne({
                where: {
                    state: FileState.UPLOADING,
                    createdAt: MoreThan(
                        new Date(Date.now() - 12 * 60 * 60 * 1000),
                    ),
                    creator: { uuid: userUUID },
                },
            })
            .then((r) => !!r);
    }

    async getTemporaryAccess(
        filenames: string[],
        missionUUID: string,
        userUUID: string,
        action?: ActionEntity,
        uploadSource = 'Web Interface',
    ): Promise<TemporaryFileAccessesDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        return await this.dataSource.transaction(async (manager) => {
            // Deduplicate filenames to avoid self-collisions
            const uniqueFilenames = [...new Set(filenames)];
            const credentials: {
                bucket: string | null;
                fileName: string;
                fileUUID: string | null;
                accessCredentials: StorageCredentials | null;
                error?: string | null;
            }[] = [];

            const invalidFiles: { filename: string; error: string }[] = [];

            // Check for existing files first to avoid transaction abortion on duplicate key error
            const existingFiles = await manager.find(FileEntity, {
                where: {
                    filename: In(uniqueFilenames),
                    mission: {
                        uuid: missionUUID,
                    },
                },
            });

            for (const filename of uniqueFilenames) {
                const emptyCredentials: {
                    bucket: string | null;
                    fileName: string;
                    fileUUID: string | null;
                    accessCredentials: StorageCredentials | null;
                    error: string | null;
                    queueUUID?: string;
                } = {
                    bucket: null,
                    fileName: filename,

                    fileUUID: null,

                    accessCredentials: null,

                    error: null,
                };

                // eslint-disable-next-line @typescript-eslint/naming-convention
                const supported_file_endings = [
                    ...FILE_EXTENSION_TO_FILE_TYPE_MAP.keys(),
                ];

                if (
                    !supported_file_endings.some((ending) =>
                        filename.endsWith(ending),
                    )
                ) {
                    emptyCredentials.error = 'Invalid file ending';
                    credentials.push(emptyCredentials);
                    continue;
                }

                const matchingFileType = supported_file_endings.find((ending) =>
                    filename.endsWith(ending),
                );
                if (matchingFileType === undefined)
                    throw new UnsupportedMediaTypeException();
                const fileType: FileType | undefined =
                    FILE_EXTENSION_TO_FILE_TYPE_MAP.get(matchingFileType);
                if (fileType === undefined)
                    throw new UnsupportedMediaTypeException();

                const existingFile = existingFiles.find(
                    (f) => f.filename === filename,
                );
                const isConflict =
                    existingFile && existingFile.state !== FileState.CANCELED;

                if (isConflict) {
                    invalidFiles.push({
                        filename,
                        error: 'File already exists',
                    });
                    continue;
                }

                try {
                    // Use a nested transaction (savepoint) for each file
                    await manager.transaction(async (nestedManager) => {
                        let file: FileEntity;
                        if (existingFile?.state === FileState.CANCELED) {
                            existingFile.state = FileState.UPLOADING;
                            existingFile.creator = user;
                            existingFile.date = new Date();
                            existingFile.size = 0;
                            existingFile.hash = '';
                            existingFile.origin = FileOrigin.UPLOAD;
                            file = await nestedManager.save(
                                FileEntity,
                                existingFile,
                            );
                        } else {
                            file = await nestedManager.save(
                                FileEntity,
                                nestedManager.create(FileEntity, {
                                    date: new Date(),
                                    size: 0,
                                    filename,
                                    mission,
                                    creator: user,
                                    type: fileType,
                                    state: FileState.UPLOADING,
                                    origin: FileOrigin.UPLOAD,
                                }),
                            );
                        }

                        await this.auditService.log(
                            FileEventType.UPLOAD_STARTED,
                            {
                                fileUuid: file.uuid,
                                filename: file.filename,
                                missionUuid: missionUUID,
                                actor: user,
                                ...(action ? { action } : {}),
                                details: {
                                    origin: FileOrigin.UPLOAD,
                                    source: uploadSource,
                                },
                            },
                            true,
                        );

                        credentials.push({
                            bucket: env.S3_DATA_BUCKET_NAME,
                            fileUUID: file.uuid,
                            fileName: filename,
                            accessCredentials:
                                await this.dataStorage.generateTemporaryCredential(
                                    file.uuid,
                                ),
                        });
                    });
                } catch (error: unknown) {
                    if (
                        error instanceof QueryFailedError &&
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        error.driverError.code === '23505'
                    ) {
                        invalidFiles.push({
                            filename,
                            error: 'File already exists',
                        });
                    } else {
                        throw error;
                    }
                }
            }

            if (invalidFiles.length > 0) {
                logger.warn(
                    `getTemporaryAccess: user="${userUUID}" mission="${missionUUID}" ` +
                        `denied upload for ${invalidFiles.length.toString()} already-existing file(s): ` +
                        invalidFiles.map((f) => `"${f.filename}"`).join(', '),
                );
                throw new ConflictException({
                    message: 'Files already exist',
                    errors: invalidFiles,
                });
            }

            return {
                // TODO: fix typing
                // @ts-ignore
                data: credentials,
                count: credentials.length,
                skip: 0,
                take: credentials.length,
            };
        });
    }

    async cancelUpload(
        uuids: string[],
        missionUUID: string,
        userUUID: string,
    ): Promise<void> {
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

                file.state = FileState.CANCELED;
                await this.fileRepository.save(file);
                return;
            }),
        );
    }

    private async canCancelUpload(
        userUUID: string,
        missionUUID: string,
    ): Promise<boolean> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });

        if (mission.project === undefined) {
            logger.error(
                `Project of mission ${mission.uuid} is undefined, skipping`,
            );
            return false;
        }

        const canAccessProject = await this.dataSource.manager.exists(
            ProjectAccessViewEntity,
            {
                where: {
                    projectUuid: mission.project.uuid,
                    userUuid: userUUID,
                    rights: MoreThanOrEqual(AccessGroupRights.WRITE),
                },
            },
        );
        if (canAccessProject) {
            return true;
        }
        return await this.dataSource.manager.exists(MissionAccessViewEntity, {
            where: {
                missionUuid: missionUUID,
                userUuid: userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }

    async deleteMultiple(
        fileUUIDs: string[],
        missionUUID: string,
    ): Promise<void> {
        if (fileUUIDs.length === 0) return;

        const uniqueFilesUuids = [...new Set(fileUUIDs)];

        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                const files = await transactionalEntityManager.find(
                    FileEntity,
                    {
                        where: {
                            uuid: In(uniqueFilesUuids),
                            mission: { uuid: missionUUID },
                        },
                    },
                );

                const uniqueDatabaseFilesUuids = [
                    ...new Set(files.map((f) => f.uuid)),
                ];
                if (
                    uniqueDatabaseFilesUuids.length !== uniqueFilesUuids.length
                ) {
                    throw new NotFoundException(
                        'Some files not found, aborting',
                    );
                }

                // Delete potentially running ingestion jobs
                await transactionalEntityManager.softDelete(
                    IngestionJobEntity,
                    {
                        identifier: In(uniqueDatabaseFilesUuids),
                    },
                );

                await Promise.all(
                    files.map(async (file) => {
                        await this.dataStorage
                            .deleteFile(file.uuid)
                            .catch(() => {
                                logger.error(
                                    `File ${file.uuid} not found in storage, deleting from database only!`,
                                );
                            });
                    }),
                );

                await transactionalEntityManager.softDelete(
                    FileEntity,
                    uniqueDatabaseFilesUuids,
                );
            },
        );
    }

    async reextractMissingTopics(): Promise<number> {
        const filesToFix = await this.fileRepository
            .createQueryBuilder('file')
            .leftJoin('file.topics', 'topic')
            .where('file.type = :type', { type: FileType.BAG })
            .andWhere('file.state = :state', { state: FileState.OK })
            .andWhere('topic.uuid IS NULL')
            .select(['file.uuid', 'file.filename'])
            .getMany();

        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        logger.debug(`Found ${filesToFix.length} bag files missing topics.`);

        for (const file of filesToFix) {
            await this.fileCleanupQueue.add('extract-topics-repair', {
                fileUuid: file.uuid,
                filename: file.filename,
            });
        }

        return filesToFix.length;
    }
}
