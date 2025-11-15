import { SortOrder } from '@common/api/types/pagination';
import { UpdateFile } from '@common/api/types/update-file.dto';
import FileEntity from '@common/entities/file/file.entity';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import env from '@common/environment';
import {
    DataType,
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    HealthStatus,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    OnModuleInit,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import jwt from 'jsonwebtoken';
import {
    Brackets,
    DataSource,
    In,
    MoreThan,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import { fileEntityToDto, fileEntityToDtoWithTopic } from '../serialization';
import {
    addFileFilters,
    addMissionFilters,
    addProjectFilters,
    addSort,
} from './utilities';

import {
    FileExistsResponseDto,
    TemporaryFileAccessDto,
    TemporaryFileAccessesDto,
} from '@common/api/types/file/access.dto';
import { FileWithTopicDto } from '@common/api/types/file/file.dto';
import { FilesDto } from '@common/api/types/file/files.dto';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { redis } from '@common/consts';
import Category from '@common/entities/category/category.entity';
import QueueEntity from '@common/entities/queue/queue.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import User from '@common/entities/user/user.entity';
import {
    addTagsToMinioObject,
    deleteFileMinio,
    externalMinio,
    generateTemporaryCredential,
    getInfoFromMinio,
    internalMinio,
} from '@common/minio-helper';
import axios from 'axios';
import Queue from 'bull';
import { BucketItem } from 'minio';
import Credentials from 'minio/dist/main/Credentials';
import { TaggingOpts } from 'minio/dist/main/internal/type';
import {
    addAccessConstraints,
    addAccessConstraintsToFileQuery,
} from '../endpoints/auth/auth-helper';
import { parseMinioMetrics } from '../endpoints/file/utilities';
import logger from '../logger'; // Type guard function to check if the error has a 'code' property

// Type guard function to check if the error has a 'code' property
function isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error;
}

const FIND_MANY_SORT_KEYS = {
    name: 'file.filename',
    filename: 'file.filename',
    createdAt: 'file.createdAt',
    updatedAt: 'file.updatedAt',
    creator: 'user.name',
};

@Injectable()
export class FileService implements OnModuleInit {
    private fileCleanupQueue!: Queue.Queue;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) {}

    onModuleInit(): void {
        this.fileCleanupQueue = new Queue('file-cleanup', {
            redis,
        });
    }

    async findMany(
        projectUuids: string[],
        projectPatterns: string[],
        missionUuids: string[],
        missionPatterns: string[],
        fileUuids: string[],
        filePatterns: string[],
        missionMetadata: Record<string, string>,
        sortBy: string | undefined,
        sortOrder: SortOrder,
        take: number,
        skip: number,
        userUuid: string,
    ): Promise<FilesDto> {
        let query = this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.creator', 'creator');

        query = addAccessConstraintsToFileQuery(query, userUuid);

        query = addProjectFilters(
            query,
            this.projectRepository,
            projectUuids,
            projectPatterns,
        );

        query = addMissionFilters(
            query,
            this.missionRepository,
            missionUuids,
            missionPatterns,
            missionMetadata,
        );

        query = addFileFilters(
            query,
            this.fileRepository,
            fileUuids,
            filePatterns,
        );

        if (sortBy !== undefined) {
            query = addSort(query, FIND_MANY_SORT_KEYS, sortBy, sortOrder);
        }

        const [files, count] = await query
            .take(take)
            .skip(skip)
            .getManyAndCount();

        return {
            data: files.map((element) => fileEntityToDto(element)),
            count,
            take,
            skip,
        };
    }

    /**
     * Finds and paginates files based on a comprehensive set of filters.
     *
     * This method uses a two-query approach to correctly handle pagination with
     * complex joins and groupings (required for 'matchAll' topics and tags):
     * 1. The first query applies all filters and retrieves *only* the UUIDs
     * of the matching files for the requested page, along with the *total count*
     * of all matching files (pre-pagination).
     * 2. The second query fetches the full file entities (with relations) for
     * the UUIDs retrieved in the first query.
     */
    async findFiltered(
        fileName: string,
        projectUUID: string,
        missionUUID: string,
        startDate: Date | undefined,
        endDate: Date | undefined,
        topics: string,
        categories: string,
        matchAllTopics: boolean,
        fileTypes: string,
        tags: Record<string, any>,
        userUUID: string,
        take: number,
        skip: number,
        sort: string,
        sortOrder: 'ASC' | 'DESC',
        health: HealthStatus,
    ): Promise<FilesDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        // Start building the query to fetch *only* IDs
        let idQuery = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid') // Select only the UUID
            .leftJoin('file.mission', 'mission')
            .leftJoin('mission.project', 'project')
            .leftJoin('file.topics', 'topic'); // Joined for filtering

        // ADMIN users see all, others are constrained
        if (user.role !== UserRole.ADMIN) {
            idQuery = addAccessConstraints(idQuery, userUUID);
        }

        // Apply simple filters
        if (fileName) {
            logger.debug(`Filtering files by filename: ${fileName}`);
            idQuery.andWhere('file.filename LIKE :fileName', {
                fileName: `%${fileName}%`,
            });
        }

        if (projectUUID) {
            logger.debug(`Filtering files by projectUUID: ${projectUUID}`);
            idQuery.andWhere('project.uuid = :projectUUID', { projectUUID });
        }

        if (missionUUID) {
            logger.debug(`Filtering files by missionUUID: ${missionUUID}`);
            idQuery.andWhere('mission.uuid = :missionUUID', { missionUUID });
        }

        if (startDate && endDate) {
            logger.debug(
                `Filtering files by date range: ${startDate.toString()} - ${endDate.toString()}`,
            );
            idQuery.andWhere('file.date BETWEEN :startDate AND :endDate', {
                startDate,
                endDate,
            });
        }

        // Apply complex filters via helper methods
        this._applyFileTypeFilter(idQuery, fileTypes);
        this._applyTopicFilter(idQuery, topics, matchAllTopics);

        if (health) {
            logger.debug(`Filtering files by health: ${health}`);
            switch (health) {
                case HealthStatus.HEALTHY: {
                    idQuery.andWhere('file.state IN (:...healthyStates)', {
                        healthyStates: [FileState.OK, FileState.FOUND],
                    });
                    break;
                }
                case HealthStatus.UNHEALTHY: {
                    idQuery.andWhere('file.state IN (:...unhealthyStates)', {
                        unhealthyStates: [
                            FileState.ERROR,
                            FileState.CONVERSION_ERROR,
                            FileState.LOST,
                            FileState.CORRUPTED,
                        ],
                    });
                    break;
                }
                case HealthStatus.UPLOADING: {
                    idQuery.andWhere('file.state = :uploadingState', {
                        uploadingState: FileState.UPLOADING,
                    });
                    break;
                }
            }
        }

        const categoryUUIDs = categories ? categories.split(',') : [];
        if (categoryUUIDs.length > 0) {
            logger.debug(`Filtering files by categories: ${categories}`);
            idQuery
                .innerJoin('file.categories', 'category')
                .andWhere('category.uuid IN (:...categoryUUIDs)', {
                    categoryUUIDs,
                });
        }

        // The tag filter is async, so it must be awaited
        if (tags && Object.keys(tags).length > 0) {
            await this._applyTagFilter(idQuery, tags);
        }

        // Group by file.uuid to deduplicate results from joins
        // and allow 'HAVING' clauses for topics and tags
        idQuery.groupBy('file.uuid');

        idQuery.orderBy(sort, sortOrder).offset(skip).limit(take);

        const [fileIdObjects, count] = await idQuery.getManyAndCount();

        if (fileIdObjects.length === 0) {
            logger.silly('No files found');
            return {
                count,
                data: [],
                take,
                skip,
            };
        }

        const fileIds = fileIdObjects.map((file) => file.uuid);

        // It must re-apply joins (for selection) and sorting.
        const files = await this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')
            .leftJoinAndSelect('file.categories', 'category')
            .where('file.uuid IN (:...fileIds)', { fileIds })
            .orderBy(sort, sortOrder)
            .getMany();

        return {
            count,
            data: files.map((element) => fileEntityToDto(element)),
            take,
            skip,
        };
    }

    /**
     * Applies file type filtering to the query.
     */
    private _applyFileTypeFilter(
        query: SelectQueryBuilder<FileEntity>,
        fileTypes: string,
    ): void {
        if (!fileTypes) {
            return;
        }

        const requestedTypes = fileTypes.split(',');
        const requestedTypesUpper = requestedTypes.map((t) => t.toUpperCase());

        // If 'ALL' is requested, do nothing (apply no filter)
        if (requestedTypesUpper.includes(FileType.ALL)) {
            return;
        }

        // Build a lookup map of valid enum values (e.g., "mcap" -> "MCAP")
        const validTypesLookup = new Map<string, string>();
        for (const type of Object.values(FileType).filter(
            (_type) => _type !== FileType.ALL,
        )) {
            validTypesLookup.set(type.toLowerCase(), type);
        }

        // Map requested types to their valid, cased enum values and deduplicate
        const typesToFilter = [
            ...new Set(
                requestedTypes
                    .map((requestType) =>
                        validTypesLookup.get(requestType.toLowerCase()),
                    )
                    .filter((type): type is string => !!type), // Filter out undefined
            ),
        ];

        if (typesToFilter.length > 0) {
            logger.debug(
                `Filtering files by types: ${typesToFilter.join(',')}`,
            );
            query.andWhere('file.type IN (:...fileTypes)', {
                fileTypes: typesToFilter,
            });
        } else {
            // No valid types were provided (e.g., "garbage,foo")
            logger.warn(`No valid file types found in filter: ${fileTypes}`);
            query.andWhere('1 = 0'); // Force query to return no results
        }
    }

    /**
     * Applies topic filtering to the query.
     */
    private _applyTopicFilter(
        query: SelectQueryBuilder<FileEntity>,
        topics: string,
        matchAllTopics: boolean,
    ): void {
        if (!topics) {
            return;
        }

        const splitTopics = topics.split(',').filter((t) => t.length > 0);
        if (splitTopics.length === 0) {
            return;
        }

        // Filter files that have *at least one* of the topics
        query.andWhere('topic.name IN (:...splitTopics)', {
            splitTopics,
        });

        // If 'matchAllTopics' is true, add a HAVING clause
        // to ensure the file has *all* requested topics.
        if (matchAllTopics) {
            query.having('COUNT(DISTINCT topic.name) = :topicCount', {
                topicCount: splitTopics.length,
            });
        }
    }

    /**
     * Applies tag filtering to the query.
     * This is the most complex filter, requiring a 'relational division' query.
     *
     * We find files where the mission has tags that match ALL specified conditions.
     * We do this by:
     * 1. Joining mission tags and tag types.
     * 2. Adding a WHERE clause: `(condition 1) OR (condition 2) OR ...`
     * 3. Adding a HAVING clause: `COUNT(DISTINCT matched_tag_types) = total_conditions`
     */
    private async _applyTagFilter(
        query: SelectQueryBuilder<FileEntity>,
        tags: Record<string, any>,
    ): Promise<void> {
        const tagTypeUUIDs = Object.keys(tags);
        if (tagTypeUUIDs.length === 0) {
            return;
        }

        const tagTypes = await this.tagTypeRepository.find({
            where: { uuid: In(tagTypeUUIDs) },
        });
        const tagTypeMap = new Map(tagTypes.map((t) => [t.uuid, t]));

        // Add the necessary joins for tag filtering
        query
            .leftJoin('mission.tags', 'tag')
            .leftJoin('tag.tagType', 'tagtype');

        const tagWhereClauses: string[] = [];
        const tagParameters = {};
        let validTagCount = 0;

        for (const uuid of tagTypeUUIDs) {
            const tagtype = tagTypeMap.get(uuid);
            if (!tagtype) {
                logger.warn(`Invalid tag type UUID in filter: ${uuid}`);
                continue;
            }

            const value = tags[uuid];
            const [column, processedValue] = this._getTagColumnAndValue(
                tagtype.datatype,
                value,
            );

            if (!column) {
                logger.warn(`Unknown data type for tag type ${uuid}`);
                continue;
            }

            // Create unique parameter names for this condition
            const uuidParameter = `tagtype${validTagCount}`;
            const valueParameter = `tagval${validTagCount}`;

            // Build the clause: (tagtype.uuid = :uuid AND tag.VALUE_COLUMN = :value)
            tagWhereClauses.push(
                `(tagtype.uuid = :${uuidParameter} AND tag.${column} = :${valueParameter})`,
            );
            tagParameters[uuidParameter] = uuid;
            tagParameters[valueParameter] = processedValue;

            validTagCount++;
        }

        if (validTagCount === 0) {
            // All provided tag filters were invalid
            query.andWhere('1 = 0'); // Return no results
            return;
        }

        query.andWhere(
            new Brackets((qb) => {
                for (const clause of tagWhereClauses) qb.orWhere(clause);
            }),
            tagParameters,
        );

        query.having('COUNT(DISTINCT tagtype.uuid) = :tagCount', {
            tagCount: validTagCount,
        });
    }

    /**
     * Helper to get the correct database column name based on
     * the tag's DataType.
     *
     * We store tag values in different columns based on their type in
     * order to support complex queries and indexing.
     *
     */
    private _getTagColumnAndValue<T>(
        dataType: DataType,
        value: T,
    ): [string | null, T | undefined] {
        switch (dataType) {
            case DataType.BOOLEAN: {
                return ['BOOLEAN', value];
            }
            case DataType.DATE: {
                return ['DATE', value];
            }
            case DataType.LOCATION: {
                return ['LOCATION', value];
            }
            case DataType.NUMBER: {
                return ['NUMBER', value];
            }
            case DataType.STRING:
            case DataType.LINK: {
                return ['STRING', value];
            }
            default: {
                return [null, undefined];
            }
        }
    }

    async findOne(uuid: string): Promise<FileWithTopicDto> {
        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: [
                'mission',
                'topics',
                'mission.project',
                'creator',
                'relatedFile',
                'relatedFile.topics',
                'categories',
            ],
        });

        return fileEntityToDtoWithTopic(file);
    }

    /**
     * Updates a file with the given uuid.
     * @param uuid
     * @param file
     */
    async update(uuid: string, file: UpdateFile): Promise<FileEntity | null> {
        logger.debug(`Updating file with uuid: ${uuid}`);
        logger.debug(`New file data: ${JSON.stringify(file)}`);

        const databaseFile = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: { mission: { project: true } },
        });

        if (!databaseFile.mission) throw new Error('Mission not found!');
        if (!databaseFile.mission.project)
            throw new Error('Project not found!');

        // validate if file ending hasn't changed
        const fileEnding =
            databaseFile.type === FileType.MCAP ? '.mcap' : '.bag';
        if (!file.filename.endsWith(fileEnding)) {
            throw new BadRequestException('File ending must not be changed');
        }

        databaseFile.filename = file.filename;
        databaseFile.date = file.date;

        if (file.missionUuid) {
            const newMission = await this.missionRepository.findOneOrFail({
                where: { uuid: file.missionUuid },
                relations: ['project'],
            });

            if (!newMission.project) throw new Error('Project not found!');

            if (newMission) {
                databaseFile.mission = newMission;
            } else {
                throw new Error('Mission not found');
            }
        }

        if (file.categories) {
            databaseFile.categories = await this.categoryRepository.find({
                where: { uuid: In(file.categories) },
            });
        }

        await this.dataSource
            .transaction(async (transactionalEntityManager) => {
                if (databaseFile.mission?.project === undefined) {
                    throw new Error('Mission or project not found!');
                }

                await transactionalEntityManager.save(
                    Project,
                    databaseFile.mission.project,
                );

                await transactionalEntityManager.save(
                    Mission,
                    databaseFile.mission,
                );
                await transactionalEntityManager.save(FileEntity, databaseFile);
            })
            .catch((error: unknown) => {
                if (isErrorWithCode(error) && error.code === '23505') {
                    throw new ConflictException(
                        'File with this name already exists in the mission',
                    );
                }
                throw error;
            });
        await addTagsToMinioObject(
            env.MINIO_DATA_BUCKET_NAME,
            databaseFile.uuid,
            {
                // @ts-expect-error
                projectUuid: databaseFile.mission.project.uuid,
                missionUuid: databaseFile.mission.uuid,
                filename: databaseFile.filename,
            },
        );
        return this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
    }

    /**
     * Generate a download link for a file with the given uuid.
     * The link will expire after 1 week if expires is set to true.
     *
     * @param uuid The unique identifier of the file
     * @param expires Whether the download link should expire
     */
    async generateDownload(uuid: string, expires: boolean): Promise<string> {
        // verify that an uuid is provided
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
        });

        // verify that the file exists in DB
        if (file.uuid === undefined || file.uuid !== uuid)
            throw new BadRequestException('File not found');

        const stats = await getInfoFromMinio(file.type, file.uuid);

        // verify that the file exists in Minio
        if (!stats) throw new NotFoundException('File not found');

        return await externalMinio.presignedUrl(
            'GET',
            env.MINIO_DATA_BUCKET_NAME,
            file.uuid, // we use the uuid as the filename in Minio
            expires ? 4 * 60 * 60 : 604_800, // 604800 seconds = 1 week
            {
                // set filename in response headers

                'response-content-disposition': `attachment; filename ="${file.filename}"`,
            },
        );
    }

    async findOneByName(
        missionUUID: string,
        name: string,
    ): Promise<FileEntity | null> {
        return this.fileRepository.findOne({
            where: { mission: { uuid: missionUUID }, filename: name },
            relations: ['creator'],
        });
    }

    async moveFiles(fileUUIDs: string[], missionUUID: string): Promise<void> {
        await Promise.all(
            fileUUIDs.map(async (uuid) => {
                try {
                    const file = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                    });
                    file.mission = { uuid: missionUUID } as Mission;
                    await this.fileRepository.save(file);
                    const newFile = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                        relations: ['mission', 'mission.project'],
                    });
                    const bucket = env.MINIO_DATA_BUCKET_NAME;

                    if (newFile.mission?.project?.uuid === undefined) {
                        logger.error(
                            `Error moving file ${uuid} to mission ${missionUUID}}. Project uuid is undefined.`,
                        );
                        return;
                    }

                    await addTagsToMinioObject(bucket, file.uuid, {
                        filename: file.filename,
                        missionUuid: missionUUID,
                        projectUuid: newFile.mission.project.uuid,
                    });
                } catch (error) {
                    logger.error(
                        `Error moving file ${uuid} to mission ${missionUUID}: ${error}`,
                    );
                }
            }),
        );
    }

    /**
     * Delete a file with the given uuid.
     * The file will be removed from the database and from Minio.
     *
     * @param uuid The unique identifier of the file
     */
    async deleteFile(uuid: string): Promise<void> {
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        logger.debug(`Deleting file with uuid: ${uuid}`);

        // we delete the file from the database and Minio
        // using a transaction to ensure consistency
        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // find the file in the database
                const file = await transactionalEntityManager.findOneOrFail(
                    FileEntity,
                    { where: { uuid } },
                );

                // delete the file from Minio
                const bucket = env.MINIO_DATA_BUCKET_NAME;
                await deleteFileMinio(bucket, file.uuid).catch(() => {
                    logger.error(
                        `File ${file.uuid} not found in Minio, deleting from database only!`,
                    );
                });

                await transactionalEntityManager.remove(file);
            },
        );

        logger.debug(`File with uuid ${uuid} deleted`);
    }

    async getStorage(): Promise<StorageOverviewDto> {
        const expiredAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

        const payload = {
            exp: expiredAt,
            sub: env.MINIO_ACCESS_KEY,
            iss: 'prometheus',
        };

        const token = jwt.sign(payload, env.MINIO_SECRET_KEY, {
            algorithm: 'HS512',
        });

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        return axios
            .get('http://minio:9000/minio/metrics/v3/system/drive', {
                headers,
            })
            .then((response) => {
                const metrics: any = parseMinioMetrics(response.data);
                return {
                    usedBytes: metrics.minio_system_drive_used_bytes[0].value,
                    totalBytes: metrics.minio_system_drive_total_bytes[0].value,
                    usedInodes: metrics.minio_system_drive_used_inodes[0].value,
                    totalInodes:
                        metrics.minio_system_drive_total_inodes[0].value,
                } as StorageOverviewDto;
            });
    }

    async isUploading(userUUID: string): Promise<boolean> {
        return this.fileRepository
            .findOne({
                where: {
                    state: FileState.UPLOADING,
                    // pending uploads get canceled after 12 hours
                    // however this cleanup is done asynchronously once a day
                    createdAt: MoreThan(
                        new Date(Date.now() - 12 * 60 * 60 * 1000),
                    ),
                    creator: { uuid: userUUID },
                },
            })
            .then((r) => !!r);
    }

    /**
     * Get temporary access to upload files to Minio.
     * This function creates a new file entry in the database and a new queue entry.
     * The queue entry is used to track the upload progress.
     *
     * The function returns a list of access credentials for each file.
     *
     * @param filenames list of filenames to upload
     * @param missionUUID the mission to upload the files to
     * @param userUUID the user that is uploading the files
     */
    async getTemporaryAccess(
        filenames: string[],
        missionUUID: string,
        userUUID: string,
    ): Promise<TemporaryFileAccessesDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const credentials = await Promise.all(
            filenames.map(async (filename) => {
                const emptyCredentials: {
                    bucket: string | null;
                    fileName: string;
                    fileUUID: string | null;
                    accessCredentials: Credentials | null;
                    error: string | null;
                    queueUUID?: string;
                } = {
                    // eslint-disable-next-line unicorn/no-null
                    bucket: null,
                    fileName: filename,
                    // eslint-disable-next-line unicorn/no-null
                    fileUUID: null,
                    // eslint-disable-next-line unicorn/no-null
                    accessCredentials: null,
                    // eslint-disable-next-line unicorn/no-null
                    error: null,
                };

                logger.debug(`Creating temporary access for file: ${filename}`);

                const fileExtensionToFileTypeMap: ReadonlyMap<
                    string,
                    FileType
                > = new Map([
                    ['.bag', FileType.BAG],
                    ['.mcap', FileType.MCAP],
                    ['.yaml', FileType.YAML],
                    ['.yml', FileType.YML],
                    ['.svo2', FileType.SVO2],
                    ['.tum', FileType.TUM],
                    ['.db3', FileType.DB3],
                ]);

                const supported_file_endings = [
                    ...fileExtensionToFileTypeMap.keys(),
                ];

                if (
                    !supported_file_endings.some((ending) =>
                        filename.endsWith(ending),
                    )
                ) {
                    emptyCredentials.error = 'Invalid file ending';
                    return emptyCredentials;
                }

                const matchingFileType = supported_file_endings.find((ending) =>
                    filename.endsWith(ending),
                );
                if (matchingFileType === undefined)
                    throw new UnsupportedMediaTypeException();
                const fileType: FileType | undefined =
                    fileExtensionToFileTypeMap.get(matchingFileType);
                if (fileType === undefined)
                    throw new UnsupportedMediaTypeException();

                // check if file already exists
                const existingFile = await this.fileRepository.exists({
                    where: {
                        filename,
                        mission: {
                            uuid: missionUUID,
                        },
                    },
                });
                if (existingFile) {
                    emptyCredentials.error = 'File already exists';
                    emptyCredentials.fileName = filename;
                    return emptyCredentials;
                }

                const file = await this.fileRepository.save(
                    this.fileRepository.create({
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

                const queueEntity = await this.queueRepository.save(
                    this.queueRepository.create({
                        identifier: file.uuid,

                        display_name: filename,
                        state: QueueState.AWAITING_UPLOAD,
                        location: FileLocation.MINIO,
                        mission,
                        creator: user,
                    }),
                );

                return {
                    bucket: env.MINIO_DATA_BUCKET_NAME,
                    fileUUID: file.uuid,
                    fileName: filename,
                    accessCredentials: await generateTemporaryCredential(
                        file.uuid,
                        env.MINIO_DATA_BUCKET_NAME,
                    ),
                    queueUUID: queueEntity.uuid,
                };
            }),
        );

        return {
            // TODO: fix typing
            data: credentials as unknown as TemporaryFileAccessDto[],
            count: credentials.length,
            skip: 0,
            take: credentials.length,
        };
    }

    async cancelUpload(
        uuids: string[],
        missionUUID: string,
        userUUID: string,
    ): Promise<Queue.Job> {
        // Cleanup cannot be done synchronously as this takes too long; the request is sent on unload; delaying the onUnload is difficult and discouraged
        return this.fileCleanupQueue.add('cancelUpload', {
            uuids,
            missionUUID,
            userUUID,
        });
    }

    /**
     * Delete multiple files with the given uuids.
     *
     * This function will remove the files from the database and from Minio.
     * The deletion fails if any of the files is not found in the database or
     * if any of the files is not found in Minio. It verifies the files in the
     * database and Minio in a single transaction to ensure consistency.
     *
     * @param fileUUIDs The unique identifiers of the files
     * @param missionUUID The unique identifier of the mission
     *
     */
    async deleteMultiple(
        fileUUIDs: string[],
        missionUUID: string,
    ): Promise<void> {
        const uniqueFilesUuids = [...new Set(fileUUIDs)];

        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // get a list of all files to delete
                const files = await transactionalEntityManager.find(
                    FileEntity,
                    // eslint-disable-next-line unicorn/no-array-method-this-argument
                    {
                        where: {
                            uuid: In(uniqueFilesUuids),
                            mission: { uuid: missionUUID },
                        },
                    },
                );

                // verify that all files are found in the database
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

                await Promise.all(
                    files.map(async (file) => {
                        const bucket = env.MINIO_DATA_BUCKET_NAME;
                        await deleteFileMinio(bucket, file.uuid).catch(() => {
                            logger.error(
                                `File ${file.uuid} not found in Minio, deleting from database only!`,
                            );
                        });
                    }),
                );

                await transactionalEntityManager.remove(files);
            },
        );
    }

    /**
     * Check if a file with the given uuid exists.
     * @param fileUUID
     */
    async exists(fileUUID: string): Promise<FileExistsResponseDto> {
        return {
            exists: await this.fileRepository.exists({
                where: { uuid: fileUUID },
            }),
            uuid: fileUUID,
        };
    }

    async renameTags(bucked: string): Promise<void> {
        const files = internalMinio.listObjects(bucked, '');
        const filesList = await files.toArray();
        await Promise.all(
            filesList.map(async (file: BucketItem) => {
                if (!file.name) {
                    logger.debug(`Filename is empty: ${JSON.stringify(file)}`);
                    return;
                }
                const fileEntity = await this.fileRepository.findOne({
                    where: { uuid: file.name },
                    relations: ['mission', 'mission.project'],
                });
                if (fileEntity === null) {
                    logger.error(`File ${file.name} not found in database`);
                    return;
                }
                await internalMinio.removeObjectTagging(
                    bucked,
                    file.name,
                    {} as TaggingOpts,
                );

                if (fileEntity.mission === undefined)
                    throw new Error('Mission not found!');
                if (fileEntity.mission.project === undefined)
                    throw new Error('Project not found!');

                await addTagsToMinioObject(bucked, file.name, {
                    projectUuid: fileEntity.mission.project.uuid,

                    missionUuid: fileEntity.mission.uuid,
                    filename: fileEntity.filename,
                });
            }),
        ).catch((error: unknown) => {
            logger.error(error);
        });
    }

    async recomputeFileSizes(): Promise<void> {
        const files = await this.fileRepository.find({
            where: {
                state: In([FileState.OK, FileState.FOUND]),
            },
        });
        await Promise.all(
            files.map(async (file) => {
                const stats = await getInfoFromMinio(file.type, file.uuid);
                if (stats) {
                    file.size = stats.size;
                    logger.debug(
                        `Updated size for ${file.filename}: ${file.size.toString()}`,
                    );
                } else {
                    logger.error(
                        `File ${file.uuid} not found in Minio, setting state to LOST`,
                    );
                    file.state = FileState.LOST;
                }
                await this.fileRepository.save(file);
            }),
        );
    }
}
