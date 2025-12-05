import { CreateProject } from '@kleinkram/api-dto';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, Not, Repository } from 'typeorm';
import { addAccessConstraintsToProjectQuery } from '../endpoints/auth/auth-helper';
import { UserService } from './user.service';

import {
    addMissionCount,
    addProjectCreatorFilter,
    addProjectFilters,
    addSort,
} from './utilities';

import {
    DefaultRightDto,
    DefaultRights,
    ProjectDto,
    ProjectsDto,
    ProjectWithRequiredTagsDto,
    ResentProjectDto,
    SortOrder,
} from '@kleinkram/api-dto';
import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/accessgroup.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@kleinkram/shared';
import { ConfigService } from '@nestjs/config';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';
import {
    projectEntityToDto,
    projectEntityToDtoWithMissionCountAndTags,
    projectEntityToDtoWithRequiredTags,
} from '../serialization';
import { AccessGroupConfig } from '../types/access-group-config';

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
        private configService: ConfigService,
        private readonly dataSource: DataSource,
    ) {
        const config = this.configService.get('accessConfig');
        if (config === undefined) throw new Error('Access config not found');
        this.config = config;
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

        return {
            data: projects.map((element) =>
                projectEntityToDtoWithMissionCountAndTags(element),
            ),
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
        return projectEntityToDtoWithRequiredTags(mission, missionCount);
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
        return projects
            .map((project: any) => {
                return {
                    name: project.project_name as string,
                    uuid: project.projectUuid as string,
                    description: project.project_description as string,
                    updatedAt: project.latestUpdate as Date,
                    createdAt: project.project_createdAt as Date,
                } as ResentProjectDto;
            })
            .sort(
                (a: ResentProjectDto, b: ResentProjectDto) =>
                    b.updatedAt.getTime() - a.updatedAt.getTime(),
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
                        `Project has ${missionCount} missions. Please delete them first.`,
                    );
                }

                // all categories will be deleted due to 'onDelete: CASCADE'.
                const deleteResult = await transactionalEntityManager.delete(
                    ProjectEntity,
                    { uuid },
                );

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
