import { addAccessConstraintsToProjectQuery } from '@/endpoints/auth/auth-helper';
import {
    CreateProject,
    DefaultRightDto,
    DefaultRights,
    ProjectDto,
    ProjectsDto,
    ProjectWithRequiredTagsDto,
    ResentProjectDto,
    SortOrder,
} from '@kleinkram/api-dto';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
    DataSource,
    EntityManager,
    ILike,
    Not,
    Repository,
    SelectQueryBuilder,
} from 'typeorm';
import { UserService } from './user.service';

import {
    addProjectCreatorFilter,
    addProjectFilters,
    addSort,
} from './utilities';

import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    projectEntityToDto,
    projectEntityToDtoWithMissionCountAndTags,
    projectEntityToDtoWithRequiredTags,
} from '@/serialization';
import {
    AccessGroupEntity,
    ActionTemplateEntity,
    ActionTriggerEntity,
    CategoryEntity,
    MissionEntity,
    ProjectAccessEntity,
    ProjectAccessViewEntity,
    ProjectEntity,
    TagTypeEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupConfig,
    AccessGroupRights,
    AccessGroupType,
    TriggerType,
    UserRole,
} from '@kleinkram/shared';
import { ConfigService } from '@nestjs/config';

/**
 * Alias of the computed column holding the total file size of a project, see
 * {@link ProjectService._addProjectSizeForSorting}. The ORDER BY refers to the
 * column by this alias, which is what makes TypeORM carry the sort over into
 * the distinct-ids query it runs for paginated queries with joins.
 */
const PROJECT_SIZE_SORT_ALIAS = 'project_total_size';

/**
 * Alias of the computed column holding the number of missions of a project, see
 * {@link ProjectService._addMissionCountForSorting}. Same reasoning as
 * {@link PROJECT_SIZE_SORT_ALIAS}.
 */
const PROJECT_MISSION_COUNT_SORT_ALIAS = 'project_mission_count';

const FIND_MANY_SORT_KEYS = {
    projectName: 'project.name',
    description: 'project.description',
    name: 'project.name',
    createdAt: 'project.createdAt',
    updatedAt: 'project.updatedAt',
    creator: 'creator.name',
    rights: 'projectAccessView.rights',
    size: PROJECT_SIZE_SORT_ALIAS,
    nrOfMissions: PROJECT_MISSION_COUNT_SORT_ALIAS,
};

@Injectable()
export class ProjectService {
    private config: AccessGroupConfig;

    constructor(
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        private userService: UserService,
        @InjectRepository(ProjectAccessEntity)
        private projectAccessRepository: Repository<ProjectAccessEntity>,
        @InjectRepository(TagTypeEntity)
        private tagTypeRepository: Repository<TagTypeEntity>,
        @InjectRepository(AccessGroupEntity)
        private accessGroupRepository: Repository<AccessGroupEntity>,
        private configService: ConfigService,
        private readonly dataSource: DataSource,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const config = this.configService.get('accessConfig');
        if (config === undefined) throw new Error('Access config not found');
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        this.config = config;
    }

    private async _getProjectSizes(
        projectUuids: string[],
    ): Promise<Map<string, number>> {
        if (projectUuids.length === 0) {
            return new Map();
        }

        const rawResults = await this.projectRepository
            .createQueryBuilder('project')
            .select('project.uuid', 'projectUuid')
            .addSelect('COALESCE(SUM(file.size), 0)', 'totalSize')
            .leftJoin(
                'project.missions',
                'mission',
                'mission.deletedAt IS NULL',
            )
            .leftJoin('mission.files', 'file', 'file.deletedAt IS NULL')
            .where('project.uuid IN (:...projectUuids)', { projectUuids })
            .groupBy('project.uuid')
            .getRawMany<{ projectUuid: string; totalSize: string }>();

        const sizeMap = new Map<string, number>();
        for (const raw of rawResults) {
            const size = Number.parseInt(raw.totalSize) || 0;
            sizeMap.set(raw.projectUuid, size);
        }
        return sizeMap;
    }

    /**
     * Counts the (non-deleted) missions of the given projects.
     *
     * TypeORM v1 removed `QueryBuilder.loadRelationCountAndMap()`, so the counts
     * are fetched with a dedicated aggregate query (the same shape as
     * `_getProjectSizes`) instead of being mapped onto the entity.
     */
    private async _getMissionCounts(
        projectUuids: string[],
    ): Promise<Map<string, number>> {
        if (projectUuids.length === 0) {
            return new Map();
        }

        const rawResults = await this.projectRepository
            .createQueryBuilder('project')
            .select('project.uuid', 'projectUuid')
            .addSelect('COUNT(mission.uuid)', 'missionCount')
            .leftJoin(
                'project.missions',
                'mission',
                'mission.deletedAt IS NULL',
            )
            .where('project.uuid IN (:...projectUuids)', { projectUuids })
            .groupBy('project.uuid')
            .getRawMany<{ projectUuid: string; missionCount: string }>();

        const countMap = new Map<string, number>();
        for (const raw of rawResults) {
            countMap.set(
                raw.projectUuid,
                Number.parseInt(raw.missionCount) || 0,
            );
        }
        return countMap;
    }

    /**
     * Adds the total size of a project (the summed size of all files of all its
     * non-deleted missions) as a computed column, so that the database can sort
     * by it.
     *
     * The size is not stored on the project and `_getProjectSizes` only fetches
     * it for the rows of the current page, which is too late for sorting.
     */
    private _addProjectSizeForSorting(
        query: SelectQueryBuilder<ProjectEntity>,
    ): SelectQueryBuilder<ProjectEntity> {
        // Correlated on purpose: the aggregate is evaluated for the projects
        // that survive the access constraints and filters of the outer query,
        // and not at all for the count query, which drops the select list.
        const totalSize = this.projectRepository.manager
            .createQueryBuilder()
            .select('COALESCE(SUM(sizeFile.size), 0)')
            .from(MissionEntity, 'sizeMission')
            .leftJoin(
                'sizeMission.files',
                'sizeFile',
                'sizeFile.deletedAt IS NULL',
            )
            .where('"sizeMission"."projectUuid" = "project"."uuid"')
            .andWhere('sizeMission.deletedAt IS NULL');

        return query.addSelect(
            `(${totalSize.getQuery()})`,
            PROJECT_SIZE_SORT_ALIAS,
        );
    }

    /**
     * Adds the number of (non-deleted) missions of a project as a computed
     * column, so that the database can sort by it.
     *
     * The count is not stored on the project and `_getMissionCounts` only
     * fetches it for the rows of the current page, which is too late for
     * sorting.
     */
    private _addMissionCountForSorting(
        query: SelectQueryBuilder<ProjectEntity>,
    ): SelectQueryBuilder<ProjectEntity> {
        // Correlated for the same reason as the size aggregate, see
        // `_addProjectSizeForSorting`.
        const missionCount = this.projectRepository.manager
            .createQueryBuilder()
            .select('COUNT(countMission.uuid)')
            .from(MissionEntity, 'countMission')
            .where('"countMission"."projectUuid" = "project"."uuid"')
            .andWhere('countMission.deletedAt IS NULL');

        return query.addSelect(
            `(${missionCount.getQuery()})`,
            PROJECT_MISSION_COUNT_SORT_ALIAS,
        );
    }

    async findMany(
        projectUuids: string[],
        projectPatterns: string[],
        sortBy: string | undefined,
        sortOrder: SortOrder,
        skip: number,
        take: number,
        creatorUuid: string | undefined,
        userUuid: string,
        exactMatch = false,
    ): Promise<ProjectsDto> {
        let query = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.requiredTags', 'requiredTags');

        query = addAccessConstraintsToProjectQuery(query, userUuid);

        query = addProjectFilters(
            query,
            this.projectRepository,
            projectUuids,
            projectPatterns,
            exactMatch,
        );

        if (sortBy === 'rights') {
            query = query.leftJoinAndSelect(
                ProjectAccessViewEntity,
                'projectAccessView',
                'projectAccessView.projectUuid = project.uuid AND projectAccessView.userUuid = :userUuidForSort',
                { userUuidForSort: userUuid },
            );
        }

        if (sortBy === 'size') {
            query = this._addProjectSizeForSorting(query);
        }

        if (sortBy === 'nrOfMissions') {
            query = this._addMissionCountForSorting(query);
        }

        if (sortBy !== undefined) {
            query = addSort(query, FIND_MANY_SORT_KEYS, sortBy, sortOrder);

            // Stable tie-breaker: rows that compare equal on the sort column
            // (projects of the same size or mission count, most notably the
            // empty ones) would otherwise be free to swap places between two
            // requests, which duplicates and drops rows across LIMIT/OFFSET
            // pages.
            query.addOrderBy('project.uuid', 'ASC');
        }

        query = addProjectCreatorFilter(query, creatorUuid);

        query.skip(skip).take(take);
        const [projects, count] = await query.getManyAndCount();

        const foundProjectUuids = projects.map((p) => p.uuid);
        const [sizes, missionCounts] = await Promise.all([
            this._getProjectSizes(foundProjectUuids),
            this._getMissionCounts(foundProjectUuids),
        ]);

        return {
            data: projects.map((element) => {
                const dto = projectEntityToDtoWithMissionCountAndTags(element);
                dto.size = sizes.get(element.uuid) ?? 0;
                dto.missionCount = missionCounts.get(element.uuid) ?? 0;
                return dto;
            }),
            count,
            skip,
            take,
        };
    }

    async findOne(uuid: string): Promise<ProjectWithRequiredTagsDto> {
        const missionPromise = this.projectRepository
            .createQueryBuilder('project')
            .where('project.uuid = :uuid', { uuid })
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.requiredTags', 'requiredTags')
            .leftJoinAndSelect('project.project_accesses', 'project_accesses')
            .leftJoinAndSelect('project_accesses.accessGroup', 'accessGroup')
            .leftJoinAndSelect('accessGroup.memberships', 'memberships')
            .leftJoinAndSelect('memberships.user', 'user')
            .getOneOrFail();

        const missionCountPromise = this.projectRepository
            .createQueryBuilder('project')
            .leftJoin('project.missions', 'missions')
            .where('project.uuid = :uuid', { uuid })
            .getCount();

        const [mission, missionCount] = await Promise.all([
            missionPromise,
            missionCountPromise,
        ]);
        const sizes = await this._getProjectSizes([uuid]);
        const dto = projectEntityToDtoWithRequiredTags(mission, missionCount);
        dto.size = sizes.get(uuid) ?? 0;
        return dto;
    }

    async getRecentProjects(
        take: number,
        user: UserEntity,
    ): Promise<ResentProjectDto[]> {
        let projects;
        if (user.role === UserRole.ADMIN) {
            // Get all Projects and add the computed field latestUpdate
            // LatestUpdate is computed in the subquery by selecting the latest updatedAt of the project, missions and files
            // This is implemented in SQL as TypeORM does not support sorting by a computed field...
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            projects = await this.projectRepository.query(
                'SELECT DISTINCT\n' +
                    '    "project"."uuid" AS "projectUuid",\n' +
                    '    "project"."createdAt" AS "project_createdAt",\n' +
                    '    "project"."updatedAt" AS "project_updatedAt",\n' +
                    '    "project"."name" AS "project_name",\n' +
                    '    "project"."description" AS "project_description",\n' +
                    '    "project"."creatorUuid" AS "project_creatorUuid",\n' +
                    '    (\n' +
                    '        SELECT\n' +
                    '            GREATEST(  MAX("project2"."updatedAt"),  MAX("missions2"."updatedAt"),  MAX("files2"."updatedAt")  ) AS "latestUpdate"\n' +
                    '        FROM\n' +
                    '            "project" "project2"\n' +
                    '                LEFT JOIN\n' +
                    '            "mission" "missions2"\n' +
                    '            ON "missions2"."projectUuid" = "project2"."uuid"\n' +
                    '                AND\n' +
                    '               (\n' +
                    '                   "missions2"."deletedAt" IS NULL\n' +
                    '                   )\n' +
                    '                LEFT JOIN\n' +
                    '            "file_entity" "files2"\n' +
                    '            ON "files2"."missionUuid" = "missions2"."uuid"\n' +
                    '                AND\n' +
                    '               (\n' +
                    '                   "files2"."deletedAt" IS NULL\n' +
                    '                   )\n' +
                    '        WHERE\n' +
                    '            (\n' +
                    '                "project2"."uuid" = "project"."uuid"\n' +
                    '                )\n' +
                    '          AND\n' +
                    '            (\n' +
                    '                "project2"."deletedAt" IS NULL\n' +
                    '                )\n' +
                    '    )\n' +
                    '        AS "latestUpdate"\n' +
                    'FROM\n' +
                    '    "project" "project"\n' +
                    '        WHERE\n' +
                    '    (\n' +
                    '        "project"."deletedAt" IS NULL\n' +
                    '        )\n' +
                    'ORDER BY\n' +
                    '    "latestUpdate" DESC\n' +
                    'LIMIT $1',
                [take],
            );
        }

        if (user.role !== UserRole.ADMIN) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            projects = await this.projectRepository.query(
                'SELECT DISTINCT\n' +
                    '   "project"."uuid" AS "projectUuid",\n' +
                    '   "project"."createdAt" AS "project_createdAt",\n' +
                    '   "project"."updatedAt" AS "project_updatedAt",\n' +
                    '   "project"."name" AS "project_name",\n' +
                    '   "project"."description" AS "project_description",\n' +
                    '   "project"."creatorUuid" AS "project_creatorUuid",\n' +
                    '   (\n' +
                    '      SELECT\n' +
                    '         GREATEST( MAX("project2"."updatedAt"), MAX("missions2"."updatedAt"), MAX("files2"."updatedAt") ) AS "latestUpdate" \n' +
                    '      FROM\n' +
                    '         "project" "project2" \n' +
                    '         LEFT JOIN\n' +
                    '            "mission" "missions2" \n' +
                    '            ON "missions2"."projectUuid" = "project2"."uuid" \n' +
                    '            AND \n' +
                    '            (\n' +
                    '               "missions2"."deletedAt" IS NULL\n' +
                    '            )\n' +
                    '         LEFT JOIN\n' +
                    '            "file_entity" "files2" \n' +
                    '            ON "files2"."missionUuid" = "missions2"."uuid" \n' +
                    '            AND \n' +
                    '            (\n' +
                    '               "files2"."deletedAt" IS NULL\n' +
                    '            )\n' +
                    '      WHERE\n' +
                    '         (\n' +
                    '            "project2"."uuid" = "project"."uuid" \n' +
                    '         )\n' +
                    '         AND \n' +
                    '         (\n' +
                    '            "project2"."deletedAt" IS NULL \n' +
                    '         )\n' +
                    '   )\n' +
                    '   AS "latestUpdate" \n' +
                    'FROM\n' +
                    '   "project" "project" \n' +
                    '   LEFT JOIN\n' +
                    '      "project_access_view_entity" "projectAccessView" \n' +
                    '      ON "projectAccessView"."projectuuid" = "project"."uuid" \n' +
                    'WHERE\n' +
                    '   (\n' +
                    '      "projectAccessView"."rights" >= $1 \n' +
                    '      AND "projectAccessView"."useruuid" = $2 \n' +
                    '   )\n' +
                    'ORDER BY\n' +
                    '   "latestUpdate" DESC \n' +
                    'LIMIT $3',
                [AccessGroupRights.READ, user.uuid, take],
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            projects

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
                .map((project: any) => {
                    return {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        name: project.project_name as string,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        uuid: project.projectUuid as string,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        description: project.project_description as string,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        updatedAt: project.latestUpdate as Date,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        createdAt: project.project_createdAt as Date,
                    };
                })
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, unicorn/no-array-sort
                .sort(
                    (a: ResentProjectDto, b: ResentProjectDto) =>
                        b.updatedAt.getTime() - a.updatedAt.getTime(),
                )
        );
    }

    async create(
        project: CreateProject,
        auth: AuthHeader,
    ): Promise<ProjectDto> {
        const exists = await this.projectRepository.exists({
            where: { name: ILike(project.name) },
        });
        if (exists) {
            throw new ConflictException(
                'Project with that name already exists',
            );
        }
        const creator = await this.userService.findOneByUUID(
            auth.user.uuid,
            {},
            { memberships: { accessGroup: true } },
        );

        if (creator.memberships === undefined)
            throw new Error('User has no memberships');

        const defaultMemberships = creator.memberships.filter(
            (accessGroupUser) =>
                accessGroupUser.accessGroup?.type !== AccessGroupType.CUSTOM,
        );

        const defaultAccessGroups = defaultMemberships
            .map((ag) => ag.accessGroup)
            .filter((ag) => ag !== undefined);

        project.requiredTags ??= [];
        const tagTypes = await Promise.all(
            project.requiredTags.map((tag) => {
                return this.tagTypeRepository.findOneOrFail({
                    where: { uuid: tag },
                });
            }),
        );
        const newProject = this.projectRepository.create({
            name: project.name,
            description: project.description,
            creator: creator,
            requiredTags: tagTypes,
            autoConvert: project.autoConvert ?? false,
            autoRecoverMcap: project.autoRecoverMcap ?? true,
        });

        const accessGroupsDefaultIds = new Set(
            defaultAccessGroups
                .map((ag) => ag.uuid)
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                .filter((id) => id !== undefined),
        );

        let deduplicatedAccessGroups: (
            | { accessGroupUUID: string; rights: AccessGroupRights }
            | { userUuid: string; rights: AccessGroupRights }
        )[] = [];
        if (project.accessGroups) {
            deduplicatedAccessGroups = project.accessGroups.filter((ag) => {
                return 'accessGroupUUID' in ag
                    ? !accessGroupsDefaultIds.has(ag.accessGroupUUID)
                    : ag.userUuid !== auth.user.uuid;
            });
        }

        const transactedProject = await this.dataSource.transaction(
            async (manager: EntityManager): Promise<ProjectEntity> => {
                const savedProject = await manager.save(
                    ProjectEntity,
                    newProject,
                );
                await this.createDefaultAccessGroups(
                    manager,
                    defaultAccessGroups,
                    savedProject,
                    project.removedDefaultGroups,
                );

                if (newProject.autoRecoverMcap) {
                    const recoverTemplate = await manager.findOne(
                        ActionTemplateEntity,
                        {
                            where: { name: 'recover-mcap', version: 1 },
                        },
                    );
                    if (recoverTemplate) {
                        const trigger = manager.create(ActionTriggerEntity, {
                            name: 'Auto-recover MCAP',
                            description:
                                'Automatically recovers corrupted MCAP files uploaded to this project',
                            template: recoverTemplate,
                            project: savedProject,
                            type: TriggerType.CORRUPTED_FILE,
                            config: { patterns: ['*.mcap'] },
                            creator: creator,
                        });
                        await manager.save(ActionTriggerEntity, trigger);
                    }
                }

                if (project.accessGroups) {
                    try {
                        await this.createSpecifiedAccessGroups(
                            manager,
                            deduplicatedAccessGroups,
                            savedProject,
                        );
                    } catch {
                        throw new BadRequestException(
                            'Failed to set permissions. One or more user/group UUIDs may be invalid.',
                        );
                    }
                }
                return savedProject;
            },
        );

        const createdProject = await this.projectRepository.findOneOrFail({
            where: { uuid: transactedProject.uuid },
        });
        return projectEntityToDto(createdProject);
    }

    async update(uuid: string, project: CreateProject): Promise<ProjectDto> {
        const exists = await this.projectRepository.exists({
            where: { name: ILike(project.name), uuid: Not(uuid) },
        });
        if (exists) {
            throw new ConflictException(
                'Project with that name already exists',
            );
        }

        await this.projectRepository.update(uuid, {
            name: project.name,
            description: project.description,
            ...(project.autoConvert === undefined
                ? {}
                : { autoConvert: project.autoConvert }),
            ...(project.autoRecoverMcap === undefined
                ? {}
                : { autoRecoverMcap: project.autoRecoverMcap }),
        });
        const updatedProject = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        return projectEntityToDto(updatedProject);
    }

    async addTagType(uuid: string, tagTypeUUID: string): Promise<void> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        project.requiredTags.push(tagType);
        await this.projectRepository.save(project);
    }

    async updateTagTypes(uuid: string, tagTypeUUIDs: string[]): Promise<void> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
            relations: {
                requiredTags: true,
            },
        });
        project.requiredTags = await Promise.all(
            tagTypeUUIDs.map((tag) => {
                return this.tagTypeRepository.findOneOrFail({
                    where: { uuid: tag },
                });
            }),
        );
        await this.projectRepository.save(project);
    }

    async removeTagType(uuid: string, tagTypeUUID: string): Promise<void> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        project.requiredTags = project.requiredTags.filter(
            (tagType) => tagType.uuid !== tagTypeUUID,
        );
        await this.projectRepository.save(project);
    }

    async deleteProject(uuid: string): Promise<void> {
        await this.dataSource.transaction(
            async (transactionalEntityManager) => {
                // Check if there are any missions with that project
                const missionCount = await transactionalEntityManager.count(
                    MissionEntity,
                    { where: { project: { uuid } } },
                );

                if (missionCount > 0) {
                    throw new ConflictException(
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        `Project has ${missionCount} missions. Please delete them first.`,
                    );
                }

                // explicitly soft-delete related categories since 'onDelete: CASCADE'
                // only applies to hard deletes at the DB level
                await transactionalEntityManager.softDelete(CategoryEntity, {
                    project: { uuid },
                });

                const deleteResult =
                    await transactionalEntityManager.softDelete(ProjectEntity, {
                        uuid,
                    });

                // If no rows were affected, the project UUID didn't exist.
                if (deleteResult.affected === 0) {
                    throw new NotFoundException(
                        `Project with UUID ${uuid} not found.`,
                    );
                }
            },
        );
    }

    async createDefaultAccessGroups(
        manager: EntityManager,
        accessGroups: AccessGroupEntity[],
        project: ProjectEntity,
        removedDefaultGroups?: string[],
    ): Promise<(ProjectAccessEntity | undefined)[]> {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (!removedDefaultGroups) {
            removedDefaultGroups = [];
        }

        return await Promise.all(
            accessGroups.map(async (accessGroup) => {
                let rights = AccessGroupRights.WRITE;

                switch (accessGroup.type) {
                    case AccessGroupType.AFFILIATION: {
                        if (removedDefaultGroups.includes(accessGroup.uuid)) {
                            return;
                        }
                        // @ts-ignore
                        rights = this.config.access_groups.find((group) => {
                            return group.uuid === accessGroup.uuid;
                        }).rights;
                        break;
                    }

                    case AccessGroupType.PRIMARY: {
                        rights = AccessGroupRights.DELETE;
                    }
                }

                const projectAccess = this.projectAccessRepository.create({
                    rights,
                    accessGroup,
                    project: project,
                });
                return manager.save(ProjectAccessEntity, projectAccess);
            }),
        );
    }

    async createSpecifiedAccessGroups(
        manager: EntityManager,
        accessGroups: (
            | { accessGroupUUID: string; rights: AccessGroupRights }
            | { userUuid: string; rights: AccessGroupRights }
        )[],
        project: ProjectEntity,
    ): Promise<Awaited<ProjectAccessEntity>[]> {
        return await Promise.all(
            accessGroups.map(async (accessGroup) => {
                let accessGroupDB: AccessGroupEntity;
                if ('accessGroupUUID' in accessGroup) {
                    accessGroupDB =
                        await this.accessGroupRepository.findOneOrFail({
                            where: {
                                uuid: accessGroup.accessGroupUUID,
                            },
                        });
                } else if ('userUuid' in accessGroup) {
                    accessGroupDB =
                        await this.accessGroupRepository.findOneOrFail({
                            where: {
                                memberships: {
                                    user: [
                                        {
                                            uuid: accessGroup.userUuid,
                                        },
                                    ],
                                },
                                type: AccessGroupType.PRIMARY,
                            },
                        });
                } else {
                    throw new ConflictException(
                        'Neither accessGroupUUID nor userUuid is present in accessGroup',
                    );
                }
                const projectAccess = this.projectAccessRepository.create({
                    rights: accessGroup.rights,
                    accessGroup: accessGroupDB,
                    project: project,
                });
                return manager.save(ProjectAccessEntity, projectAccess);
            }),
        );
    }

    async getDefaultRights(auth: AuthHeader): Promise<DefaultRights> {
        const creator = await this.userService.findOneByUUID(
            auth.user.uuid,
            {},
            { memberships: { accessGroup: true } },
        );

        if (creator.memberships === undefined)
            throw new Error('User has no memberships');

        const defaultRights: (DefaultRightDto | undefined)[] =
            await Promise.all(
                creator.memberships
                    .map((membership) => membership.accessGroup)
                    .map(async (right) => {
                        if (right === undefined) return;

                        const name = right.name;
                        let memberCount = 1;
                        let _rights: AccessGroupRights | undefined =
                            AccessGroupRights.WRITE;

                        switch (right.type) {
                            case AccessGroupType.AFFILIATION: {
                                _rights =
                                    this.config.access_groups.find(
                                        (group) => group.uuid === right.uuid,
                                    )?.rights ?? undefined;

                                // Catch the case where there are no default rights
                                // defined for the affiliation group
                                if (_rights === undefined) return;

                                memberCount =
                                    await this.userService.getMemberCount(
                                        right.uuid,
                                    );
                                break;
                            }
                            case AccessGroupType.PRIMARY: {
                                _rights = AccessGroupRights.DELETE;
                                break;
                            }
                            case AccessGroupType.CUSTOM: {
                                return;
                            }
                        }

                        return {
                            name,
                            uuid: right.uuid,
                            memberCount,
                            rights: _rights,
                            type: right.type,
                        };
                    }),
            );

        const defaultRightsFiltered = defaultRights.filter(
            (right) => right !== undefined,
        );

        return {
            data: defaultRightsFiltered,
            count: defaultRightsFiltered.length,
            skip: 0,
            take: defaultRightsFiltered.length,
        };
    }
}
