import { addAccessConstraintsToProjectQuery } from '@/endpoints/auth/auth-helper';
import {
    CreateProject,
    DefaultRightDto,
    DefaultRights,
    MigrateProjectDto,
    MigrateProjectResponseDto,
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
    QueryFailedError,
    Repository,
} from 'typeorm';
import { UserService } from './user.service';

import {
    addMissionCount,
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
    CategoryEntity,
    MissionEntity,
    ProjectAccessEntity,
    ProjectEntity,
    TagTypeEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import env from '@kleinkram/backend-common/environment';
import { StorageService } from '@kleinkram/backend-common/modules/storage/storage.service';
import {
    AccessGroupConfig,
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { ConfigService } from '@nestjs/config';

const FIND_MANY_SORT_KEYS = {
    projectName: 'project.name',
    description: 'project.description',
    name: 'project.name',
    createdAt: 'project.createdAt',
    updatedAt: 'project.updatedAt',
    creator: 'creator.name',
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
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        private configService: ConfigService,
        private readonly dataSource: DataSource,
        private readonly storageService: StorageService,
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

        if (sortBy !== undefined) {
            query = addSort(query, FIND_MANY_SORT_KEYS, sortBy, sortOrder);
        }

        query = addProjectCreatorFilter(query, creatorUuid);
        query = addMissionCount(query);

        query.skip(skip).take(take);
        const [projects, count] = await query.getManyAndCount();

        const foundProjectUuids = projects.map((p) => p.uuid);
        const sizes = await this._getProjectSizes(foundProjectUuids);

        return {
            data: projects.map((element) => {
                const dto = projectEntityToDtoWithMissionCountAndTags(element);
                dto.size = sizes.get(element.uuid) ?? 0;
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
                    } as ResentProjectDto;
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
        });

        const accessGroupsDefaultIds = new Set(
            defaultAccessGroups
                .map((ag) => ag.uuid)
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                .filter((id) => id !== undefined),
        );

        let deduplicatedAccessGroups: (
            | { accessGroupUUID: string; rights: AccessGroupRights }
            | { userUUID: string; rights: AccessGroupRights }
        )[] = [];
        if (project.accessGroups) {
            deduplicatedAccessGroups = project.accessGroups.filter((ag) => {
                return 'accessGroupUUID' in ag
                    ? !accessGroupsDefaultIds.has(ag.accessGroupUUID)
                    : ag.userUUID !== auth.user.uuid;
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
            relations: ['requiredTags'],
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

    async migrateProject(
        dto: MigrateProjectDto,
    ): Promise<MigrateProjectResponseDto> {
        const { sourceProjectUUID, targetProjectUUID, archiveSourceProjectAs } =
            dto;

        if (sourceProjectUUID === targetProjectUUID) {
            throw new BadRequestException(
                'Source and target project must be different',
            );
        }

        const sourceProject = await this.projectRepository.findOne({
            where: { uuid: sourceProjectUUID },
        });
        if (!sourceProject) {
            throw new NotFoundException(
                `Project with UUID ${sourceProjectUUID} not found`,
            );
        }

        const targetProject = await this.projectRepository.findOne({
            where: { uuid: targetProjectUUID },
        });
        if (!targetProject) {
            throw new NotFoundException(
                `Project with UUID ${targetProjectUUID} not found`,
            );
        }

        if (archiveSourceProjectAs !== undefined) {
            const archiveNameTaken = await this.projectRepository.exists({
                where: {
                    uuid: Not(sourceProjectUUID),
                    name: ILike(archiveSourceProjectAs),
                },
            });
            if (archiveNameTaken) {
                throw new ConflictException(
                    `Project with name '${archiveSourceProjectAs}' already exists`,
                );
            }
        }

        const sourceMissions = await this.missionRepository.find({
            where: { project: { uuid: sourceProjectUUID } },
            relations: ['files'],
        });

        const targetMissions = await this.missionRepository.find({
            where: { project: { uuid: targetProjectUUID } },
        });
        const targetMissionNames = new Set(targetMissions.map((m) => m.name));
        const collidingMissionNames = sourceMissions
            .map((mission) => mission.name)
            .filter((name) => targetMissionNames.has(name));

        if (collidingMissionNames.length > 0) {
            throw new ConflictException(
                `Target project already contains mission names: ${collidingMissionNames.join(', ')}`,
            );
        }

        const movedMissionUUIDs = sourceMissions.map((mission) => mission.uuid);
        const movedFiles = sourceMissions.flatMap((mission) =>
            (mission.files ?? []).map((file) => ({
                fileUUID: file.uuid,
                filename: file.filename,
                missionUUID: mission.uuid,
                sourceProjectUUID,
            })),
        );

        try {
            await this.dataSource.transaction(async (manager) => {
                for (const mission of sourceMissions) {
                    await manager.getRepository(MissionEntity).update(
                        mission.uuid,
                        {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                            project: { uuid: targetProjectUUID } as any,
                        },
                    );
                }

                if (archiveSourceProjectAs !== undefined) {
                    await manager.getRepository(ProjectEntity).update(
                        sourceProjectUUID,
                        {
                            name: archiveSourceProjectAs,
                        },
                    );
                }

                await Promise.all(
                    movedFiles.map(async (file) => {
                        await this.storageService.addTags(
                            env.MINIO_DATA_BUCKET_NAME,
                            file.fileUUID,
                            {
                                filename: file.filename,
                                missionUuid: file.missionUUID,
                                projectUuid: targetProjectUUID,
                            },
                        );
                    }),
                );
            });
        } catch (error) {
            await Promise.all(
                movedFiles.map(async (file) => {
                    await this.storageService.addTags(
                        env.MINIO_DATA_BUCKET_NAME,
                        file.fileUUID,
                        {
                            filename: file.filename,
                            missionUuid: file.missionUUID,
                            projectUuid: file.sourceProjectUUID,
                        },
                    );
                }),
            );
            if (
                error instanceof QueryFailedError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error.driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'Project migration conflicted with existing names',
                );
            }
            throw error;
        }

        return {
            success: true,
            sourceProjectUUID,
            targetProjectUUID,
            movedMissionCount: movedMissionUUIDs.length,
            movedFileCount: movedFiles.length,
            movedMissionUUIDs,
        };
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
            | { userUUID: string; rights: AccessGroupRights }
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
                } else if ('userUUID' in accessGroup) {
                    accessGroupDB =
                        await this.accessGroupRepository.findOneOrFail({
                            where: {
                                memberships: {
                                    user: [
                                        {
                                            uuid: accessGroup.userUUID,
                                        },
                                    ],
                                },
                                type: AccessGroupType.PRIMARY,
                            },
                        });
                } else {
                    throw new ConflictException(
                        'Neither accessGroupUUID nor userUUID is present in accessGroup',
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
                        } as DefaultRightDto;
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
