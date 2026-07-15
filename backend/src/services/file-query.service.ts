import {
    addAccessConstraintsToFileQuery,
    addAccessConstraintsToMissionQuery,
    addAccessConstraintsToProjectQuery,
} from '@/endpoints/auth/auth-helper';
import { fileEntityToDto, fileEntityToDtoWithTopic } from '@/serialization';
import {
    FileEventsDto,
    FileExistsResponseDto,
    FileQueryDto,
    FilesDto,
    FileWithTopicDto,
    SortOrder,
} from '@kleinkram/api-dto';
import { FileEventEntity } from '@kleinkram/backend-common/entities/file/file-event.entity';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    DataType,
    FileState,
    FileType,
    HealthStatus,
    UserRole,
} from '@kleinkram/shared';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import logger from '../logger';
import {
    addFileFilters,
    addMissionFilters,
    addProjectFilters,
    addSort,
    convertGlobToLikePattern,
} from './utilities';

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
export class FileQueryService {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        @InjectRepository(TagTypeEntity)
        private tagTypeRepository: Repository<TagTypeEntity>,
        @InjectRepository(FileEventEntity)
        private eventRepo: Repository<FileEventEntity>,
    ) {}

    async findMany(
        query: FileQueryDto,
        userUuid: string,
        apiKeyMissionUuid?: string,
    ): Promise<FilesDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUuid },
        });

        // Start building the query to fetch *only* IDs
        let idQuery = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid') // Select only the UUID
            .leftJoin('file.mission', 'mission')
            .leftJoin('mission.project', 'project')
            .leftJoin('file.topics', 'topic')
            .leftJoin('file.creator', 'creator');

        // ADMIN users see all, others are constrained
        if (user.role !== UserRole.ADMIN) {
            idQuery = addAccessConstraintsToFileQuery(idQuery, userUuid);
        }

        // Apply project filters
        const projectUuids =
            query.projectUuids ??
            (query.projectUUID ? [query.projectUUID] : []);
        if (
            projectUuids.length > 0 ||
            (query.projectPatterns && query.projectPatterns.length > 0)
        ) {
            idQuery = addProjectFilters(
                idQuery,
                this.projectRepository,
                projectUuids,
                query.projectPatterns ?? [],
                query.exactMatch === 'true',
            );
        }

        // Apply mission filters
        const missionUuids =
            query.missionUuids ??
            (query.missionUUID
                ? [query.missionUUID]
                : apiKeyMissionUuid
                  ? [apiKeyMissionUuid]
                  : []);
        if (
            missionUuids.length > 0 ||
            (query.missionPatterns && query.missionPatterns.length > 0) ||
            (query.metadata && Object.keys(query.metadata).length > 0)
        ) {
            idQuery = addMissionFilters(
                idQuery,
                this.missionRepository,
                missionUuids,
                query.missionPatterns ?? [],
                query.metadata ?? {},
            );
        }

        // Apply simple filters
        if (query.fileName) {
            logger.debug(`Filtering files by filename: ${query.fileName}`);
            const tokens = query.fileName.trim().split(/\s+/);

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

        if (
            (query.fileUuids && query.fileUuids.length > 0) ||
            (query.filePatterns && query.filePatterns.length > 0)
        ) {
            idQuery = addFileFilters(
                idQuery,
                this.fileRepository,
                query.fileUuids ?? [],
                query.filePatterns ?? [],
            );
        }

        const fileExtensions = query.fileExtensions;
        if (fileExtensions && fileExtensions.length > 0) {
            idQuery.andWhere(
                new Brackets((qb) => {
                    for (const [index, extension] of fileExtensions.entries()) {
                        qb.orWhere(`file.filename LIKE :ext_${String(index)}`, {
                            [`ext_${String(index)}`]: `%${extension}`,
                        });
                    }
                }),
            );
        }

        if (query.startDate) {
            logger.debug(
                `Filtering files by start date: ${query.startDate.toString()}`,
            );
            idQuery.andWhere('file.date >= :startDate', {
                startDate: query.startDate,
            });
        }

        if (query.endDate) {
            logger.debug(
                `Filtering files by end date: ${query.endDate.toString()}`,
            );
            idQuery.andWhere('file.date <= :endDate', {
                endDate: query.endDate,
            });
        }

        // Apply complex filters via helper methods
        this._applyFileTypeFilter(idQuery, query.fileTypes);
        this._applyTopicFilter(idQuery, query.topics, query.matchAllTopics);
        this._applyMessageDatatypeFilter(idQuery, query.messageDatatypes);

        const topicPatterns = query.topicPatterns;
        if (topicPatterns && topicPatterns.length > 0) {
            idQuery.andWhere(
                new Brackets((qb) => {
                    for (const [index, pat] of topicPatterns.entries()) {
                        qb.orWhere(
                            `topic.name ILIKE :topicPat_${String(index)}`,
                            {
                                [`topicPat_${String(index)}`]:
                                    convertGlobToLikePattern(pat),
                            },
                        );
                    }
                }),
            );
        }

        if (query.health) {
            logger.debug(`Filtering files by health: ${query.health}`);
            switch (query.health) {
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

        if (query.includeStates && query.includeStates.length > 0) {
            idQuery.andWhere('file.state IN (:...includeStates)', {
                includeStates: query.includeStates,
            });
        }

        if (query.excludeStates && query.excludeStates.length > 0) {
            idQuery.andWhere('file.state NOT IN (:...excludeStates)', {
                excludeStates: query.excludeStates,
            });
        }

        const categoryUUIDs = query.categories
            ? query.categories.split(',')
            : [];
        if (categoryUUIDs.length > 0) {
            logger.debug(
                `Filtering files by categories: ${query.categories ?? ''}`,
            );
            idQuery
                .innerJoin('file.categories', 'category')
                .andWhere('category.uuid IN (:...categoryUUIDs)', {
                    categoryUUIDs,
                });
        }
        const categoryPatterns = query.categoryPatterns;
        if (categoryPatterns && categoryPatterns.length > 0) {
            if (categoryUUIDs.length === 0) {
                idQuery.innerJoin('file.categories', 'category');
            }
            idQuery.andWhere(
                new Brackets((qb) => {
                    for (const [index, pat] of categoryPatterns.entries()) {
                        qb.orWhere(
                            `category.name ILIKE :catPat_${String(index)}`,
                            {
                                [`catPat_${String(index)}`]:
                                    convertGlobToLikePattern(pat),
                            },
                        );
                    }
                }),
            );
        }

        // The tag filter is async, so it must be awaited
        if (query.tags && Object.keys(query.tags).length > 0) {
            await this._applyTagFilter(idQuery, query.tags);
        }

        // Group by file.uuid to deduplicate results from joins
        // and allow 'HAVING' clauses for topics and tags
        idQuery.groupBy('file.uuid');

        const sortField = query.sort ?? query.sortBy ?? 'createdAt';
        let order = query.sortOrder;
        if (query.sortDirection) {
            order =
                query.sortDirection === 'DESC' ? SortOrder.DESC : SortOrder.ASC;
        }

        idQuery = addSort(idQuery, FIND_MANY_SORT_KEYS, sortField, order);

        const take = query.take;
        const skip = query.skip;
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

        filesQuery = addSort(filesQuery, FIND_MANY_SORT_KEYS, sortField, order);

        const files = await filesQuery.getMany();

        return {
            count,
            data: files.map((element) => fileEntityToDto(element)),
            take,
            skip,
        };
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

    async findOneByName(
        missionUUID: string,
        name: string,
    ): Promise<FileEntity | null> {
        return this.fileRepository.findOne({
            where: { mission: { uuid: missionUUID }, filename: name },
            relations: ['creator'],
        });
    }

    async exists(fileUUID: string): Promise<FileExistsResponseDto> {
        return {
            exists: await this.fileRepository.exists({
                where: { uuid: fileUUID },
            }),
            uuid: fileUUID,
        };
    }

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
        };
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
        };
    }

    private _applyFileTypeFilter(
        query: SelectQueryBuilder<FileEntity>,
        fileTypes: string | undefined,
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

    private _applyTopicFilter(
        query: SelectQueryBuilder<FileEntity>,
        topics: string | undefined,
        matchAllTopics: boolean | undefined,
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

    private _applyMessageDatatypeFilter(
        query: SelectQueryBuilder<FileEntity>,
        messageDatatype: string | undefined,
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
}
