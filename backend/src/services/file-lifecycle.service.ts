import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { TriggerService } from '@/services/trigger.service';
import { TemporaryFileAccessesDto, UpdateFile } from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { ApiKeyEntity } from '@kleinkram/backend-common/entities/auth/api-key.entity';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { TopicEntity } from '@kleinkram/backend-common/entities/topic/topic.entity';
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
import { isValidFileName, splitFileName } from '@kleinkram/validation';
import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    HttpStatus,
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
    ['.md', FileType.MD],
    ['.csv', FileType.CSV],
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
        private readonly missionGuardService: MissionGuardService,
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
        apiKey?: ApiKeyEntity,
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
            // An API key is scoped to a single mission and the guard of this
            // route only ever validates the key against the file it addresses.
            // Authorizing the target mission through the rights of the key
            // owner would let a key move files out of its own scope, so keys
            // may not move files at all (as for `PATCH /files`).
            if (apiKey) {
                throw new ForbiddenException(
                    'API keys cannot move files between missions',
                );
            }

            // The route guard only authorizes the file itself, so the target
            // mission is checked here through the very same service the guard
            // of `PATCH /files` uses: moving a file there creates it there.
            if (
                !actor ||
                !(await this.missionGuardService.canAccessMission(
                    actor,
                    file.missionUuid,
                    AccessGroupRights.CREATE,
                ))
            ) {
                throw new ForbiddenException(
                    'You do not have permission to move files into the target mission',
                );
            }

            oldMissionUuid = databaseFile.mission.uuid;
            const newMission = await this.missionRepository.findOneOrFail({
                where: { uuid: file.missionUuid },
                relations: {
                    project: true,
                },
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
                // a file of the same name already exists in the mission
                throw this.toConflictOnDuplicateName(
                    error,
                    databaseFile.mission,
                );
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
            relations: {
                mission: {
                    project: true,
                },
            },
        });
    }

    /**
     * Loads and validates the files and the target mission of a move or copy.
     *
     * Every file must exist. `renames` may give a file a new name in the
     * target mission; the extension must stay the same. No resulting name may
     * clash with a file of the target mission or with another file of the
     * request. Nothing is changed here: a failed check throws before any file
     * is touched.
     */
    private async prepareTransfer(
        fileUUIDs: string[],
        missionUUID: string,
        renames: Record<string, string>,
        { skipFilesInTarget }: { skipFilesInTarget: boolean },
    ): Promise<{
        targetMission: MissionEntity;
        files: FileEntity[];
        targetNames: Map<string, string>;
    }> {
        const uniqueFileUuids = [...new Set(fileUUIDs)];

        const targetMission = await this.missionRepository.findOne({
            where: { uuid: missionUUID },
            relations: { project: true },
        });
        if (!targetMission) {
            throw new NotFoundException('Target mission not found');
        }

        const unknownRenames = Object.keys(renames).filter(
            (uuid) => !uniqueFileUuids.includes(uuid),
        );
        if (unknownRenames.length > 0) {
            throw new BadRequestException(
                `Renames name files that are not part of the request: ${unknownRenames.join(', ')}`,
            );
        }

        const loaded = await this.fileRepository.find({
            where: { uuid: In(uniqueFileUuids) },
            relations: { mission: true },
        });
        if (loaded.length !== uniqueFileUuids.length) {
            const found = new Set(loaded.map((file) => file.uuid));
            const missing = uniqueFileUuids.filter((uuid) => !found.has(uuid));
            throw new NotFoundException(
                `Files not found: ${missing.join(', ')}`,
            );
        }
        // keep the order of the request
        const byUuid = new Map(loaded.map((file) => [file.uuid, file]));
        const files = uniqueFileUuids
            .map((uuid) => byUuid.get(uuid))
            .filter((file): file is FileEntity => !!file)
            .filter(
                (file) =>
                    !skipFilesInTarget || file.mission?.uuid !== missionUUID,
            );

        const renameByUuid = new Map(Object.entries(renames));
        const targetNames = new Map<string, string>();
        for (const file of files) {
            const newName = renameByUuid.get(file.uuid);
            if (newName === undefined || newName === file.filename) {
                targetNames.set(file.uuid, file.filename);
                continue;
            }
            if (!isValidFileName(newName)) {
                throw new BadRequestException(
                    `Filename "${newName}" is not valid`,
                );
            }
            if (
                splitFileName(newName).extension.toLowerCase() !==
                splitFileName(file.filename).extension.toLowerCase()
            ) {
                throw new BadRequestException(
                    `"${newName}" must keep the extension of "${file.filename}"`,
                );
            }
            targetNames.set(file.uuid, newName);
        }

        const names = [...targetNames.values()];
        const duplicatesInRequest = names.filter(
            (name, index) => names.indexOf(name) !== index,
        );
        const existingInTarget = await this.findExistingFilenames(
            missionUUID,
            names,
        );
        // A file that keeps its name in its own mission does not clash with
        // itself (copy into the source mission needs a rename anyway).
        const conflicts = [
            ...new Set([...duplicatesInRequest, ...existingInTarget]),
        ];
        conflicts.sort();
        if (conflicts.length > 0) {
            throw new ConflictException(
                `Mission "${targetMission.name}" already contains a file ` +
                    `named ${conflicts.join(', ')}. Rename or skip the ` +
                    'conflicting files. No file was changed.',
            );
        }

        return { targetMission, files, targetNames };
    }

    /**
     * Returns the subset of `filenames` that exist in the mission.
     */
    async findExistingFilenames(
        missionUUID: string,
        filenames: string[],
    ): Promise<string[]> {
        if (filenames.length === 0) return [];
        const existing = await this.fileRepository.find({
            select: { uuid: true, filename: true },
            where: {
                mission: { uuid: missionUUID },
                filename: In([...new Set(filenames)]),
            },
        });
        return [...new Set(existing.map((file) => file.filename))];
    }

    /**
     * Moves files into another mission, which may belong to another project.
     *
     * The move is all-or-nothing, see `prepareTransfer` for the checks.
     * Files that already live in the target mission stay where they are.
     */
    async moveFiles(
        fileUUIDs: string[],
        missionUUID: string,
        actor?: UserEntity,
        action?: ActionEntity,
        renames: Record<string, string> = {},
    ): Promise<void> {
        const { targetMission, files, targetNames } =
            await this.prepareTransfer(fileUUIDs, missionUUID, renames, {
                skipFilesInTarget: true,
            });
        if (files.length === 0) return;

        const previous = new Map(
            files.map((file) => [
                file.uuid,
                { missionUuid: file.mission?.uuid, filename: file.filename },
            ]),
        );

        try {
            await this.dataSource.transaction(async (manager) => {
                for (const file of files) {
                    file.mission = targetMission;
                    file.filename = targetNames.get(file.uuid) ?? file.filename;
                }
                await manager.save(FileEntity, files);
            });
        } catch (error: unknown) {
            throw this.toConflictOnDuplicateName(error, targetMission);
        }

        // The files are moved. Audit events, triggers and storage tags are
        // follow-up work: a failure there must not report the move as failed.
        await Promise.all(
            files.map(async (file) => {
                const before = previous.get(file.uuid);
                try {
                    await this.auditService.log(
                        FileEventType.MOVED,
                        {
                            fileUuid: file.uuid,
                            filename: file.filename,
                            missionUuid: missionUUID,
                            ...(actor ? { actor } : {}),
                            ...(action ? { action } : {}),
                            details: {
                                fromMission: before?.missionUuid,
                                toMission: missionUUID,
                            },
                        },
                        true,
                    );
                    await this.triggerService.addFileEvent(
                        file.uuid,
                        TriggerEvent.MOVE,
                    );
                    if (before && before.filename !== file.filename) {
                        await this.auditService.log(
                            FileEventType.RENAMED,
                            {
                                fileUuid: file.uuid,
                                filename: file.filename,
                                missionUuid: missionUUID,
                                ...(actor ? { actor } : {}),
                                ...(action ? { action } : {}),
                                details: {
                                    oldFilename: before.filename,
                                    newFilename: file.filename,
                                },
                            },
                            true,
                        );
                        await this.triggerService.addFileEvent(
                            file.uuid,
                            TriggerEvent.RENAME,
                        );
                    }
                    await this.dataStorage.addTags(file.uuid, {
                        filename: file.filename,
                        missionUuid: missionUUID,
                        projectUuid: targetMission.project?.uuid ?? '',
                    });
                } catch (error) {
                    logger.error(
                        `Moved file ${file.uuid}, but updating its events or ` +
                            `storage tags failed: ${String(error)}`,
                    );
                }
            }),
        );
    }

    /**
     * Copies files into another mission, which may belong to another project.
     * The originals stay where they are. The data is copied inside the storage
     * bucket; nothing is downloaded.
     *
     * A copy keeps the name (or the name from `renames`), the dates, the hash
     * and the topics of its original. Categories belong to a project and are
     * only kept when the copy stays in the same project.
     */
    async copyFiles(
        fileUUIDs: string[],
        missionUUID: string,
        actor: UserEntity,
        renames: Record<string, string> = {},
    ): Promise<string[]> {
        const { targetMission, files, targetNames } =
            await this.prepareTransfer(fileUUIDs, missionUUID, renames, {
                skipFilesInTarget: false,
            });

        const notReady = files.filter((file) => file.state !== FileState.OK);
        if (notReady.length > 0) {
            throw new ConflictException(
                `Only files in state OK can be copied: ${notReady
                    .map((file) => `${file.filename} (${file.state})`)
                    .join(', ')}`,
            );
        }

        const sources = await this.fileRepository.find({
            where: { uuid: In(files.map((file) => file.uuid)) },
            relations: {
                topics: true,
                categories: true,
                mission: { project: true },
            },
        });
        const sourceByUuid = new Map(sources.map((file) => [file.uuid, file]));

        let copies: FileEntity[];
        try {
            copies = await this.dataSource.transaction(async (manager) => {
                const created: FileEntity[] = [];
                for (const file of files) {
                    const source = sourceByUuid.get(file.uuid) ?? file;
                    const sameProject =
                        source.mission?.project?.uuid !== undefined &&
                        source.mission.project.uuid ===
                            targetMission.project?.uuid;

                    const copy = manager.create(FileEntity, {
                        filename: targetNames.get(file.uuid) ?? file.filename,
                        mission: targetMission,
                        creator: actor,
                        date: source.date,
                        recordingStartDate: source.recordingStartDate ?? null,
                        recordingEndDate: source.recordingEndDate ?? null,
                        recordingTimesCheckedAt:
                            source.recordingTimesCheckedAt ?? null,
                        size: source.size,
                        type: source.type,
                        // OK only once the data is copied, see below
                        state: FileState.UPLOADING,
                        ...(source.hash ? { hash: source.hash } : {}),
                        ...(source.origin ? { origin: source.origin } : {}),
                        categories: sameProject ? source.categories : [],
                    });
                    const saved = await manager.save(FileEntity, copy);
                    if (source.topics && source.topics.length > 0) {
                        await manager.save(
                            TopicEntity,
                            source.topics.map((topic) =>
                                manager.create(TopicEntity, {
                                    name: topic.name,
                                    type: topic.type,
                                    ...(topic.nrMessages === undefined
                                        ? {}
                                        : { nrMessages: topic.nrMessages }),
                                    messageEncoding: topic.messageEncoding,
                                    frequency: topic.frequency,
                                    file: saved,
                                }),
                            ),
                        );
                    }
                    created.push(saved);
                }
                return created;
            });
        } catch (error: unknown) {
            throw this.toConflictOnDuplicateName(error, targetMission);
        }

        // Copy the data. A copy that fails is marked as ERROR so it is visible
        // in the target mission instead of silently missing.
        const failed: string[] = [];
        await Promise.all(
            copies.map(async (copy, index) => {
                const source = files[index];
                try {
                    await this.dataStorage.copyFile(source.uuid, copy.uuid);
                    await this.dataStorage.addTags(copy.uuid, {
                        filename: copy.filename,
                        missionUuid: missionUUID,
                        projectUuid: targetMission.project?.uuid ?? '',
                    });
                    await this.fileRepository.update(copy.uuid, {
                        state: FileState.OK,
                    });
                } catch (error) {
                    logger.error(
                        `Copying file ${source.uuid} to ${copy.uuid} failed: ${String(error)}`,
                    );
                    failed.push(source.filename);
                    await this.fileRepository.update(copy.uuid, {
                        state: FileState.ERROR,
                        stateComment: 'Copying the data failed',
                    });
                    return;
                }

                try {
                    await this.auditService.log(
                        FileEventType.CREATED,
                        {
                            fileUuid: copy.uuid,
                            filename: copy.filename,
                            missionUuid: missionUUID,
                            actor,
                            details: {
                                copiedFrom: source.uuid,
                                fromMission: source.mission?.uuid,
                            },
                        },
                        true,
                    );
                    await this.triggerService.addFileEvent(
                        copy.uuid,
                        TriggerEvent.UPLOAD,
                    );
                } catch (error) {
                    logger.error(
                        `Copied file ${copy.uuid}, but logging its events ` +
                            `failed: ${String(error)}`,
                    );
                }
            }),
        );

        if (failed.length > 0) {
            throw new HttpException(
                `Copying the data of ${failed.join(', ')} failed. The ` +
                    'copies are marked as ERROR in the target mission.',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        return copies.map((copy) => copy.uuid);
    }

    /**
     * A unique-name violation means a file with the same name was added to the
     * target mission after `prepareTransfer` checked it.
     */
    private toConflictOnDuplicateName(
        error: unknown,
        targetMission: MissionEntity | undefined,
    ): unknown {
        if (
            error instanceof QueryFailedError &&
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            error.driverError.code === '23505'
        ) {
            return new ConflictException(
                `Mission "${targetMission?.name ?? ''}" already contains a ` +
                    'file with the same name. No file was changed.',
            );
        }
        return error;
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
            relations: {
                mission: true,
            },
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
        fileSizes?: number[],
    ): Promise<TemporaryFileAccessesDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: {
                project: true,
            },
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        if (
            fileSizes &&
            fileSizes.length > 0 &&
            this.dataStorage.getSystemMetrics
        ) {
            const metrics = await this.dataStorage.getSystemMetrics();
            const freeBytes = metrics.totalBytes - metrics.usedBytes;
            const totalRequestedSize = fileSizes.reduce(
                (sum, size) => sum + size,
                0,
            );
            if (totalRequestedSize > freeBytes) {
                throw new HttpException(
                    'Insufficient storage space on the server',
                    HttpStatus.INSUFFICIENT_STORAGE,
                );
            }
        }

        // Only DB rows are created inside the transaction. Credentials are
        // issued after commit, so a rollback never leaves valid credentials
        // behind and the STS calls don't hold a DB connection.
        const entries = await this.dataSource.transaction(async (manager) => {
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
                            accessCredentials: null,
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

            return credentials;
        });

        try {
            for (const entry of entries) {
                if (entry.fileUUID === null) continue;
                entry.accessCredentials =
                    await this.dataStorage.generateTemporaryCredential(
                        entry.fileUUID,
                    );
            }
        } catch (error: unknown) {
            // Mark the reserved files as canceled so a retry can reuse them
            // instead of hitting "File already exists". Only touch rows still
            // UPLOADING: a reused file may have been confirmed meanwhile by a
            // previous uploader holding older credentials.
            const reservedUUIDs = entries
                .map((entry) => entry.fileUUID)
                .filter((uuid): uuid is string => uuid !== null);
            if (reservedUUIDs.length > 0) {
                await this.fileRepository.update(
                    { uuid: In(reservedUUIDs), state: FileState.UPLOADING },
                    { state: FileState.CANCELED },
                );
            }
            throw error;
        }

        return {
            // TODO: fix typing
            // @ts-ignore
            data: entries,
            count: entries.length,
            skip: 0,
            take: entries.length,
        };
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
                    relations: {
                        mission: true,
                    },
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
            relations: {
                project: true,
            },
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
