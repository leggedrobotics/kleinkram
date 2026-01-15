import { fileEntityToDto, fileEntityToDtoWithTopic } from '@/serialization';
import {
    FileEventsDto,
    FileExistsResponseDto,
    FilesDto,
    FileWithTopicDto,
    SortOrder,
    StorageOverviewDto,
    TemporaryFileAccessesDto,
    UpdateFile,
} from '@kleinkram/api-dto';
import { FileAuditService } from '@kleinkram/backend-common/audit/file-audit.service';
import { redis } from '@kleinkram/backend-common/consts';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { CategoryEntity } from '@kleinkram/backend-common/entities/category/category.entity';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { IngestionJobEntity } from '@kleinkram/backend-common/entities/file/ingestion-job.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import env from '@kleinkram/backend-common/environment';
import {
    DataType,
    FileEventType,
    FileOrigin,
    FileState,
    FileType,
    HealthStatus,
    UserRole,
} from '@kleinkram/shared';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    OnModuleInit,
    UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    Brackets,
    DataSource,
    In,
    MoreThan,
    QueryFailedError,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import {
    addFileFilters,
    addMissionFilters,
    addProjectFilters,
    addSort,
    convertGlobToLikePattern,
} from './utilities';

import { TriggerService } from '@/services/trigger.service';
import { TriggerEvent } from '@kleinkram/shared';

import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import Queue from 'bull';
// @ts-ignore
import Credentials from 'minio/dist/main/Credentials';
// @ts-ignore
import {
    addAccessConstraints,
    addAccessConstraintsToFileQuery,
    addAccessConstraintsToMissionQuery,
    addAccessConstraintsToProjectQuery,
} from '@/endpoints/auth/auth-helper';
import { BucketItem } from 'minio/dist/main/internal/type';
import logger from '../logger';

const FIND_MANY_SORT_KEYS = {
    name: 'file.filename',
    filename: 'file.filename',
    createdAt: 'file.createdAt',
    updatedAt: 'file.updatedAt',
    creator: 'user.name',
    size: 'file.size',
    state: 'file.state',
    date: 'file.date',

    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.filename': 'file.filename',

    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.createdAt': 'file.createdAt',

    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.updatedAt': 'file.updatedAt',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.size': 'file.size',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.state': 'file.state',
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'file.date': 'file.date',
};

@Injectable()
export class FileService implements OnModuleInit {
    private fileCleanupQueue!: Queue.Queue;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        private readonly dataSource: DataSource,
        @InjectRepository(TagTypeEntity)
        private tagTypeRepository: Repository<TagTypeEntity>,
        @InjectRepository(IngestionJobEntity)
        private queueRepository: Repository<IngestionJobEntity>,
        @InjectRepository(CategoryEntity)
        private categoryRepository: Repository<CategoryEntity>,
        private readonly storageService: StorageService,
        @InjectRepository(FileEventEntity)
        private eventRepo: Repository<FileEventEntity>,
        private readonly auditService: FileAuditService,
        private readonly triggerService: TriggerService,
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
     * Checks if the user has access to the specified missions and projects.
     *
     * This method is NOT intended for fine-grained access control, but rather
     * to produce nice error messages when a user tries to access resources they
     * should not.
     */
    async checkResourceAccess(
        projectUuids: string[],
        missionUuids: string[],
        userUuid: string,
    ): Promise<void> {
        // Verify Projects
        if (projectUuids.length > 0) {
            const uniqueProjectUuids = [...new Set(projectUuids)];

            let query = this.projectRepository.createQueryBuilder('project');

            // Filter by the specific requested IDs
            query.where('project.uuid IN (:...uuids)', {
                uuids: uniqueProjectUuids,
            });

            // Apply standard security constraints (Admins see all; Users see their own)
            query = addAccessConstraintsToProjectQuery(query, userUuid);

            // Fetch allowed IDs
            const foundProjects = await query.select('project.uuid').getMany();
            const foundUuids = new Set(foundProjects.map((p) => p.uuid));

            // Calculate missing
            const missing = uniqueProjectUuids.filter(
                (id) => !foundUuids.has(id),
            );

            if (missing.length > 0) {
                throw new NotFoundException(
                    `The following Project UUIDs do not exist or you do not have access: ${missing.join(', ')}`,
                );
            }
        }

        // Verify Missions
        if (missionUuids.length > 0) {
            const uniqueMissionUuids = [...new Set(missionUuids)];

            let query = this.missionRepository
                .createQueryBuilder('mission')
                .select('mission.uuid')
                .leftJoin('mission.project', 'project');

            // Filter by the specific requested IDs
            query.where('mission.uuid IN (:...uuids)', {
                uuids: uniqueMissionUuids,
            });

            // Apply standard security constraints
            query = addAccessConstraintsToMissionQuery(query, userUuid);

            // Fetch allowed IDs
            const foundMissions = await query.select('mission.uuid').getMany();
            const foundUuids = new Set(foundMissions.map((m) => m.uuid));

            // Calculate missing
            const missing = uniqueMissionUuids.filter(
                (id) => !foundUuids.has(id),
            );

            if (missing.length > 0) {
                throw new NotFoundException(
                    `The following Mission UUIDs do not exist or you do not have access: ${missing.join(', ')}`,
                );
            }
        }
    }

    /**
     *
     * Checks if the user has access to the specified missions and projects by name patterns.
     * This method supports exact matches as well as wildcard patterns.
     *
     * This method is NOT intended for fine-grained access control, but rather
     * to produce nice error messages when a user tries to access resources they
     * should not.
     *
     */
    async checkResourceAccessByName(
        projectNamePatterns: string[],
        missionNamePatterns: string[],
        userUuid: string,
        exactMatch = false,
    ): Promise<void> {
        logger.debug(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Checking resource access by name for user ${userUuid}. Projects: ${projectNamePatterns}, Missions: ${missionNamePatterns}, Exact: ${exactMatch}`,
        );

        // We use addProjectFilters which supports exactMatch natively
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (projectNamePatterns && projectNamePatterns.length > 0) {
            const missingPatterns: string[] = [];

            for (const pattern of projectNamePatterns) {
                let query =
                    this.projectRepository.createQueryBuilder('project');

                query = addAccessConstraintsToProjectQuery(query, userUuid);
                query = addProjectFilters(
                    query,
                    this.projectRepository,
                    [],
                    [pattern],
                    exactMatch,
                );

                const count = await query.getCount();
                if (count === 0) {
                    missingPatterns.push(pattern);
                }
            }

            if (missingPatterns.length > 0) {
                throw new NotFoundException(
                    `The following Project patterns matched no accessible resources: ${missingPatterns.join(', ')}`,
                );
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (missionNamePatterns && missionNamePatterns.length > 0) {
            const missingPatterns: string[] = [];

            for (const pattern of missionNamePatterns) {
                let query = this.missionRepository
                    .createQueryBuilder('mission')
                    .leftJoin('mission.project', 'project');

                query = addAccessConstraintsToMissionQuery(query, userUuid);

                if (exactMatch) {
                    query.andWhere('LOWER(mission.name) = LOWER(:pattern)', {
                        pattern,
                    });
                } else {
                    const likePattern = convertGlobToLikePattern(pattern);
                    // Use standard wildcard match (case-insensitive)
                    query.andWhere('LOWER(mission.name) LIKE :pattern', {
                        pattern: `%${likePattern.toLowerCase()}%`,
                    });
                }

                const count = await query.getCount();
                if (count === 0) {
                    missingPatterns.push(pattern);
                }
            }

            if (missingPatterns.length > 0) {
                throw new NotFoundException(
                    `The following Mission patterns matched no accessible resources: ${missingPatterns.join(', ')}`,
                );
            }
        }
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
        messageDatatype: string,
        categories: string,
        matchAllTopics: boolean,
        fileTypes: string,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            idQuery = addAccessConstraints(idQuery, userUUID);
        }

        // Apply simple filters
        if (fileName) {
            logger.debug(`Filtering files by filename: ${fileName}`);
            const tokens = fileName.trim().split(/\s+/);

            if (tokens.length > 0) {
                idQuery.andWhere(
                    new Brackets((qb) => {
                        for (const [index, token] of tokens.entries()) {
                            qb.andWhere(
                                `file.filename ILIKE :fileName_${String(index)}`,
                                {
                                    [`fileName_${String(index)}`]: `%${token}%`,
                                },
                            );
                        }
                    }),
                );
            }
        }

        if (projectUUID) {
            logger.debug(`Filtering files by projectUUID: ${projectUUID}`);
            idQuery.andWhere('project.uuid = :projectUUID', { projectUUID });
        }

        if (missionUUID) {
            logger.debug(`Filtering files by missionUUID: ${missionUUID}`);
            idQuery.andWhere('mission.uuid = :missionUUID', { missionUUID });
        }

        if (startDate) {
            logger.debug(
                `Filtering files by start date: ${startDate.toString()}`,
            );
            idQuery.andWhere('file.date >= :startDate', { startDate });
        }

        if (endDate) {
            logger.debug(`Filtering files by end date: ${endDate.toString()}`);
            idQuery.andWhere('file.date <= :endDate', { endDate });
        }

        // Apply complex filters via helper methods
        this._applyFileTypeFilter(idQuery, fileTypes);
        this._applyTopicFilter(idQuery, topics, matchAllTopics);
        this._applyMessageDatatypeFilter(idQuery, messageDatatype);

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (tags && Object.keys(tags).length > 0) {
            await this._applyTagFilter(idQuery, tags);
        }

        // Group by file.uuid to deduplicate results from joins
        // and allow 'HAVING' clauses for topics and tags
        idQuery.groupBy('file.uuid');

        const order = sortOrder === 'ASC' ? SortOrder.ASC : SortOrder.DESC;

        idQuery = addSort(idQuery, FIND_MANY_SORT_KEYS, sort, order);
        idQuery.offset(skip).limit(take);

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
        let filesQuery = this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')
            .leftJoinAndSelect('file.categories', 'category')
            .where('file.uuid IN (:...fileIds)', { fileIds });

        filesQuery = addSort(filesQuery, FIND_MANY_SORT_KEYS, sort, order);

        const files = await filesQuery.getMany();

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
        // Manually add 'yml' to map to YAML since we merged them
        validTypesLookup.set('yml', FileType.YAML);

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
     * Applies message datatype filtering to the query.
     */
    private _applyMessageDatatypeFilter(
        query: SelectQueryBuilder<FileEntity>,
        messageDatatype: string,
    ): void {
        if (!messageDatatype) {
            return;
        }

        const splitMessageDatatype = messageDatatype
            .split(',')
            .filter((t) => t.length > 0);
        if (splitMessageDatatype.length === 0) {
            return;
        }

        // Filter files that have *at least one* of the message datatypes
        query.andWhere('topic.type IN (:...splitMessageDatatype)', {
            splitMessageDatatype,
        });
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tagParameters: Record<string, any> = {};
        const validTagNames = new Set<string>();
        let validTagCount = 0;

        for (const uuid of tagTypeUUIDs) {
            const tagtype = tagTypeMap.get(uuid);
            if (!tagtype) {
                logger.warn(`Invalid tag type UUID in filter: ${uuid}`);
                continue;
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const value = tags[uuid];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const [column, processedValue] = this._getTagColumnAndValue(
                tagtype.datatype,
                value,
            );

            if (!column) {
                logger.warn(`Unknown data type for tag type ${uuid}`);
                continue;
            }

            // Create unique parameter names for this condition
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            const uuidParameter = `tagtype${validTagCount}`;
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            const valueParameter = `tagval${validTagCount}`;

            // Build the clause: (tagtype.uuid = :uuid AND tag.VALUE_COLUMN = :value)
            tagWhereClauses.push(
                `(tagtype.uuid = :${uuidParameter} AND tag.${column} = :${valueParameter})`,
            );
            tagParameters[uuidParameter] = uuid;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            tagParameters[valueParameter] = processedValue;

            validTagCount++;
            validTagNames.add(tagtype.name);
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

        query.having('COUNT(DISTINCT tagtype.name) = :tagCount', {
            tagCount: validTagNames.size,
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
                'categories',
                'parent',
                'parent.topics',
                'derivedFiles',
                'derivedFiles.topics',
            ],
        });

        return fileEntityToDtoWithTopic(file);
    }

    async getFileEvents(fileUuid: string): Promise<FileEventsDto> {
        const events = await this.eventRepo.find({
            where: {
                file: { uuid: fileUuid },
            },
            relations: ['actor', 'action', 'action.template', 'action.creator'],
            order: { createdAt: 'DESC' },
        });

        return {
            count: events.length,
            data:
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                events.map((event) => ({
                    uuid: event.uuid,
                    type: event.type,
                    createdAt: event.createdAt,
                    details: event.details,
                    actor: event.actor
                        ? {
                              uuid: event.actor.uuid,
                              name: event.actor.name,
                              avatarUrl: null,
                              email: null,
                          }
                        : undefined,
                    action: event.action
                        ? {
                              uuid: event.action.uuid,

                              name: event.action.template?.name,

                              creator: event.action.creator
                                  ? {
                                        uuid: event.action.creator.uuid,

                                        name: event.action.creator.name,
                                        avatarUrl: null,
                                        email: null,
                                    }
                                  : undefined,
                          }
                        : undefined,
                })) ?? [],
        } as FileEventsDto;
    }

    async getActionFileEvents(actionUuid: string): Promise<FileEventsDto> {
        const events = await this.eventRepo.find({
            where: {
                action: { uuid: actionUuid },
            },
            relations: [
                'actor',
                'action',
                'action.template',
                'file',
                'file.mission',
                'file.mission.project',
            ],
            order: { createdAt: 'DESC' },
        });

        return {
            count: events.length,
            data:
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                events.map((event) => ({
                    uuid: event.uuid,
                    type: event.type,
                    createdAt: event.createdAt,
                    details: event.details,
                    actor: event.actor
                        ? {
                              uuid: event.actor.uuid,
                              name: event.actor.name,
                              avatarUrl: null,
                              email: null,
                          }
                        : undefined,
                    action: event.action
                        ? {
                              uuid: event.action.uuid,

                              name: event.action.template?.name,
                          }
                        : undefined,
                    file: event.file
                        ? {
                              uuid: event.file.uuid,
                              filename: event.file.filename,
                              missionUuid: event.file.mission?.uuid ?? '',
                              missionName: event.file.mission?.name ?? '',
                              projectUuid:
                                  event.file.mission?.project?.uuid ?? '',
                              projectName:
                                  event.file.mission?.project?.name ?? '',
                          }
                        : undefined,
                })) ?? [],
        } as FileEventsDto;
    }

    /**
     * Updates a file with the given uuid.
     * @param uuid
     * @param file
     */
    /**
     * Updates a file with the given uuid.
     */
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
        const fileEnding =
            databaseFile.type === FileType.MCAP ? '.mcap' : '.bag';
        if (!file.filename.endsWith(fileEnding)) {
            throw new BadRequestException('File ending must not be changed');
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

        await this.storageService.addTags(
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
     // eslint-disable-next-line @typescript-eslint/naming-convention
     * @param uuid The unique identifier of the file
     * @param expires Whether the download link should expire
     * @param preview_only
     * @param actor
     * @param action
     */
    async generateDownload(
        uuid: string,
        expires: boolean,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        preview_only: boolean,
        actor?: UserEntity,
        action?: ActionEntity,
    ): Promise<string> {
        // verify that an uuid is provided
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: ['mission'],
        });

        // verify that the file exists in DB
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (file.uuid === undefined || file.uuid !== uuid)
            throw new BadRequestException('File not found');

        const stats = await this.storageService.getFileInfo(
            env.MINIO_DATA_BUCKET_NAME,
            file.uuid,
        );

        // verify that the file exists in Minio
        if (!stats) throw new NotFoundException('File not found');

        // TODO: find a better solution to avoid leaking download links without logging
        //    we use that to preview the messages without spamming the audit log
        if (!preview_only) {
            await this.auditService.log(
                FileEventType.DOWNLOADED,
                {
                    fileUuid: file.uuid,
                    filename: file.filename,
                    missionUuid: file.mission?.uuid ?? '',
                    details: { expiresIn: expires ? '4 hours' : '1 week' },
                    ...(actor ? { actor } : {}),
                    ...(action ? { action } : {}),
                },
                true,
            );
        }

        return await this.storageService.getPresignedDownloadUrl(
            env.MINIO_DATA_BUCKET_NAME,
            file.uuid,
            expires ? 4 * 60 * 60 : 604_800,
            {
                // set filename in response headers
                // eslint-disable-next-line @typescript-eslint/naming-convention
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
                    await this.storageService.addTags(
                        env.MINIO_DATA_BUCKET_NAME,
                        file.uuid,
                        {
                            filename: file.filename,
                            missionUuid: missionUUID,
                            projectUuid: newFile.mission?.project?.uuid ?? '',
                        },
                    );
                } catch (error) {
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    logger.error(`Error moving file ${uuid}: ${error}`);
                }
            }),
        );
    }

    /**
     * Delete a file with the given uuid.
     * The file will be removed from the database and from Minio.
     *
     * @param uuid The unique identifier of the file
     * @param actor
     * @param action
     */
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
                const bucket = env.MINIO_DATA_BUCKET_NAME;
                await this.storageService
                    .deleteFile(bucket, fileToDelete.uuid)
                    .catch(() => {
                        logger.error(
                            `File ${fileToDelete.uuid} not found in Minio, deleting from database only!`,
                        );
                    });

                await transactionalEntityManager.remove(fileToDelete);
            },
        );

        logger.debug(`File with uuid ${uuid} deleted`);
        await this.triggerService.addFileEvent(uuid, TriggerEvent.DELETE);
    }

    async getStorage(): Promise<StorageOverviewDto> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const metrics = await this.storageService.getSystemMetrics();

        return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            usedBytes: metrics.minio_system_drive_used_bytes?.[0]?.value ?? 0,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            totalBytes: metrics.minio_system_drive_total_bytes?.[0]?.value ?? 0,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            usedInodes: metrics.minio_system_drive_used_inodes?.[0]?.value ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            totalInodes:
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                metrics.minio_system_drive_total_inodes?.[0]?.value ?? 0,
        } as StorageOverviewDto;
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
     * @param action
     * @param uploadSource
     */
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
                accessCredentials: Credentials | null;
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

            const existingFilenames = new Set(
                existingFiles.map((f) => f.filename),
            );

            for (const filename of uniqueFilenames) {
                const emptyCredentials: {
                    bucket: string | null;
                    fileName: string;
                    fileUUID: string | null;
                    accessCredentials: Credentials | null;
                    error: string | null;
                    queueUUID?: string;
                } = {
                    bucket: null,
                    fileName: filename,

                    fileUUID: null,

                    accessCredentials: null,

                    error: null,
                };

                const fileExtensionToFileTypeMap: ReadonlyMap<
                    string,
                    FileType
                > = new Map([
                    ['.bag', FileType.BAG],

                    ['.mcap', FileType.MCAP],
                    ['.yaml', FileType.YAML],
                    ['.yml', FileType.YAML],
                    ['.svo2', FileType.SVO2],
                    ['.tum', FileType.TUM],
                    ['.db3', FileType.DB3],
                ]);

                // eslint-disable-next-line @typescript-eslint/naming-convention
                const supported_file_endings = [
                    ...fileExtensionToFileTypeMap.keys(),
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
                    fileExtensionToFileTypeMap.get(matchingFileType);
                if (fileType === undefined)
                    throw new UnsupportedMediaTypeException();

                if (existingFilenames.has(filename)) {
                    invalidFiles.push({
                        filename,
                        error: 'File already exists',
                    });
                    continue;
                }

                try {
                    // Use a nested transaction (savepoint) for each file
                    await manager.transaction(async (nestedManager) => {
                        const file = await nestedManager.save(
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
                            bucket: env.MINIO_DATA_BUCKET_NAME,
                            fileUUID: file.uuid,
                            fileName: filename,
                            accessCredentials:
                                await this.storageService.generateTemporaryCredential(
                                    file.uuid,
                                    env.MINIO_DATA_BUCKET_NAME,
                                ),
                        });

                        // Add to local set to catch duplicates in the same batch
                        existingFilenames.add(filename);
                    });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } catch (error: any) {
                    if (
                        error instanceof QueryFailedError &&
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        error.driverError.code === '23505'
                    ) {
                        invalidFiles.push({
                            filename,
                            error: 'File already exists',
                        });
                        // Also add to set so we don't try again if it appears again in list (though deduplication handles this)
                        existingFilenames.add(filename);
                    } else {
                        throw error;
                    }
                }
            }

            if (invalidFiles.length > 0) {
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
    ): Promise<Queue.Job> {
        // Cleanup cannot be done synchronously as this takes too long; the request is sent on unload; delaying the onUnload is difficult and discouraged
        return this.fileCleanupQueue.add('cancelUpload', {
            uuids,
            missionUUID,
            userUUID,
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
                        const bucket = env.MINIO_DATA_BUCKET_NAME;
                        await this.storageService
                            .deleteFile(bucket, file.uuid)
                            .catch(() => {
                                logger.error(
                                    `File ${file.uuid} not found in Minio, deleting from database only!`,
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

    async exists(fileUUID: string): Promise<FileExistsResponseDto> {
        return {
            exists: await this.fileRepository.exists({
                where: { uuid: fileUUID },
            }),
            uuid: fileUUID,
        };
    }

    async renameTags(bucket: string): Promise<void> {
        const filesList = await this.storageService.listFiles(bucket);

        await Promise.all(
            filesList.map(async (file: BucketItem): Promise<void> => {
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

                await this.storageService.removeTags(bucket, file.name);

                if (fileEntity.mission === undefined)
                    throw new Error('Mission not found!');
                if (fileEntity.mission.project === undefined)
                    throw new Error('Project not found!');

                await this.storageService.addTags(bucket, file.name, {
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
                const stats = await this.storageService.getFileInfo(
                    file.type,
                    file.uuid,
                );

                if (stats) {
                    file.size = stats.size;
                    logger.debug(
                        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                        `Updated size for ${file.filename}: ${file.size?.toString()}`,
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
