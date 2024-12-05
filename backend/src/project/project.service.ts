import { ConflictException, Injectable } from '@nestjs/common';
import Project from '@common/entities/project/project.entity';
import { DataSource, EntityManager, ILike, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import { AuthRes } from '../auth/paramDecorator';
import User from '@common/entities/user/user.entity';
import { UserService } from '../user/user.service';

import {
    AccessGroupRights,
    AccessGroupType,
    UserRole,
} from '@common/frontend_shared/enum';
import TagType from '@common/entities/tagType/tagType.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import { ConfigService } from '@nestjs/config';
import { AccessGroupConfig } from '../app.module';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { DefaultRights } from '@common/api/types/access-control/default-rights';
import { ResentProjectDto } from '@common/api/types/RecentProjects.dto';
import { DefaultRightDto } from '@common/api/types/access-control/default-right.dto';
import { ProjectsDto } from '@common/api/types/project/projects.dto';
import { ProjectWithMissionsDto } from '@common/api/types/project/project-with-missions.dto';

@Injectable()
export class ProjectService {
    private config: AccessGroupConfig;

    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        private userService: UserService,
        @InjectRepository(ProjectAccess)
        private projectAccessRepository: Repository<ProjectAccess>,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        private configService: ConfigService,
        private readonly dataSource: DataSource,
    ) {
        const config = this.configService.get('accessConfig');
        if (config === undefined) throw new Error('Access config not found');
        this.config = config;
    }

    async findAll(
        user: User,
        skip: number,
        take: number,
        sortBy: string,
        sortDirection: 'ASC' | 'DESC',
        searchParameters: Map<string, string>,
    ): Promise<ProjectsDto> {
        // convert take and skip to numbers
        take = Number(take);
        skip = Number(skip);

        let baseQuery = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.missions', 'missions');

        // if not admin, only show projects that the user has access to
        if (user.role !== UserRole.ADMIN) {
            baseQuery = baseQuery
                .leftJoin('project.project_accesses', 'projectAccesses')
                .leftJoin('projectAccesses.accessGroup', 'accessGroup')
                .innerJoin(
                    'accessGroup.memberships',
                    'memberships',
                    'memberships.expirationDate IS NULL OR memberships.expirationDate > NOW()',
                )
                .leftJoin('memberships.user', 'user')
                .where('projectAccesses.rights >= :rights', {
                    rights: AccessGroupRights.READ,
                })
                .andWhere('user.uuid = :uuid', { uuid: user.uuid });
        }

        // add sorting
        if (
            sortBy &&
            [
                'name',
                'createdAt',
                'updatedAt',
                'creator',
                'description',
            ].includes(sortBy) // SQL Sanitization
        ) {
            baseQuery = baseQuery.orderBy(`project.${sortBy}`, sortDirection);
        } else if (sortBy !== undefined && sortBy !== '') {
            throw new ConflictException('Invalid sortBy parameter');
        }

        if (searchParameters) {
            for (const [index, key] of Object.keys(
                searchParameters,
            ).entries()) {
                if (!['name', 'creator.uuid'].includes(key)) {
                    continue;
                }
                baseQuery = key.toLowerCase().includes('uuid')
                    ? baseQuery.andWhere(
                          `project.${key} = :${index.toString()}`,
                          {
                              [index]: searchParameters[key],
                          },
                      )
                    : baseQuery.andWhere(
                          `project.${key} ILIKE :${index.toString()}`,
                          {
                              [index]: `%${searchParameters[key].toString()}%`,
                          },
                      );
            }
        }

        const [projects, count] = await baseQuery
            .skip(skip)
            .take(take)
            .getManyAndCount();

        return {
            data: projects.map((p) => p.flatProjectDto),
            count,
            skip,
            take,
        };
    }

    async findOne(uuid: string): Promise<ProjectWithMissionsDto> {
        return (
            await this.projectRepository
                .createQueryBuilder('project')
                .where('project.uuid = :uuid', { uuid })
                .leftJoinAndSelect('project.creator', 'creator')
                .leftJoinAndSelect('project.missions', 'missions')
                .leftJoinAndSelect('project.requiredTags', 'requiredTags')
                .leftJoinAndSelect(
                    'project.project_accesses',
                    'project_accesses',
                )
                .leftJoinAndSelect(
                    'project_accesses.accessGroup',
                    'accessGroup',
                )
                .leftJoinAndSelect('accessGroup.memberships', 'memberships')
                .leftJoinAndSelect('memberships.user', 'user')
                .getOneOrFail()
        ).projectDto;
    }

    async findOneByName(name: string): Promise<ProjectWithMissionsDto> {
        return (await this.projectRepository.findOneOrFail({
            where: { name },
            relations: ['requiredTags'],
        })) as unknown as ProjectWithMissionsDto;
    }

    async getRecentProjects(
        take: number,
        user: User,
    ): Promise<ResentProjectDto[]> {
        let res;
        if (user.role === UserRole.ADMIN) {
            // Get all Projects and add the computed field latestUpdate
            // LatestUpdate is computed in the subquery by selecting the latest updatedAt of the project, missions and files
            // This is implemented in SQL as TypeORM does not support sorting by a computed field...
            res = await this.projectRepository.query(
                'SELECT DISTINCT\n' +
                    '    "project"."uuid" AS "project_uuid",\n' +
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
            res = await this.projectRepository.query(
                'SELECT DISTINCT\n' +
                    '   "project"."uuid" AS "project_uuid",\n' +
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
        return res
            .map((project: any) => {
                return {
                    name: project.project_name as string,
                    uuid: project.project_uuid as string,
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
        auth: AuthRes,
    ): Promise<ProjectWithMissionsDto> {
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

        if (!project.requiredTags) {
            project.requiredTags = [];
        }

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
            async (manager) => {
                const savedProject = await manager.save(Project, newProject);
                await this.createDefaultAccessGroups(
                    manager,
                    defaultAccessGroups,
                    savedProject,
                    project.removedDefaultGroups,
                );

                if (project.accessGroups) {
                    await this.createSpecifiedAccessGroups(
                        manager,
                        deduplicatedAccessGroups,
                        savedProject,
                    );
                }
                return savedProject;
            },
        );
        return (await this.projectRepository.findOneOrFail({
            where: { uuid: transactedProject.uuid },
        })) as unknown as ProjectWithMissionsDto;
    }

    async update(
        uuid: string,
        project: { name: string; description: string },
    ): Promise<ProjectWithMissionsDto> {
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
        });
        return (await this.projectRepository.findOneOrFail({
            where: { uuid },
        })) as unknown as ProjectWithMissionsDto;
    }

    async addTagType(uuid: string, tagTypeUUID: string): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        const tagType = await this.tagTypeRepository.findOneOrFail({
            where: { uuid: tagTypeUUID },
        });
        project.requiredTags.push(tagType);
        return this.projectRepository.save(project);
    }

    async updateTagTypes(
        uuid: string,
        tagTypeUUIDs: string[],
    ): Promise<Project> {
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
        return this.projectRepository.save(project);
    }

    async removeTagType(uuid: string, tagTypeUUID: string): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        project.requiredTags = project.requiredTags.filter(
            (tagType) => tagType.uuid !== tagTypeUUID,
        );
        return this.projectRepository.save(project);
    }

    async deleteProject(uuid: string): Promise<void> {
        // count missions of project
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
            relations: ['missions'],
        });

        if (project.missions === undefined)
            throw new Error('Project has no missions');

        const missionCount = project.missions.length;
        if (missionCount > 0) {
            throw new ConflictException(
                `Project has ${missionCount.toString()} missions. Please delete them first.`,
            );
        }

        await this.projectRepository.delete(uuid);
    }

    async createDefaultAccessGroups(
        manager: EntityManager,
        accessGroups: AccessGroup[],
        project: Project,
        removedDefaultGroups?: string[],
    ) {
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
                return manager.save(ProjectAccess, projectAccess);
            }),
        );
    }

    async createSpecifiedAccessGroups(
        manager: EntityManager,
        accessGroups: (
            | { accessGroupUUID: string; rights: AccessGroupRights }
            | { userUUID: string; rights: AccessGroupRights }
        )[],
        project: Project,
    ) {
        return await Promise.all(
            accessGroups.map(async (accessGroup) => {
                let accessGroupDB: AccessGroup;
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
                return manager.save(ProjectAccess, projectAccess);
            }),
        );
    }

    async getDefaultRights(auth: AuthRes): Promise<DefaultRights> {
        const creator = await this.userService.findOneByUUID(
            auth.user.uuid,
            {},
            { memberships: { accessGroup: true } },
        );

        if (creator.memberships === undefined)
            throw new Error('User has no memberships');

        const defaultRights: DefaultRightDto[] = (
            await Promise.all(
                creator.memberships
                    .map((membership) => membership.accessGroup)
                    .map(async (right) => {
                        if (right === undefined) return null;

                        const name = right.name;
                        let memberCount = 1;
                        let _rights = AccessGroupRights.WRITE;

                        switch (right.type) {
                            case AccessGroupType.AFFILIATION: {
                                // @ts-ignore
                                _rights = this.config.access_groups.find(
                                    (group) => group.uuid === right.uuid,
                                ).rights;
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
                                return null;
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
            )
        ).filter((right) => right !== null);

        return {
            data: defaultRights,
            count: defaultRights.length,
            skip: 0,
            take: defaultRights.length,
        };
    }
}
