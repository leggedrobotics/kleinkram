import { ConflictException, Injectable } from '@nestjs/common';
import Project from '@common/entities/project/project.entity';
import { DataSource, EntityManager, ILike, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import { AuthRes } from '../auth/paramDecorator';
import User from '@common/entities/user/user.entity';
import { UserService } from '../user/user.service';

import { AccessGroupRights, UserRole } from '@common/enum';
import TagType from '@common/entities/tagType/tagType.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import { ConfigService } from '@nestjs/config';
import { AccessGroupConfig } from '../app.module';
import AccessGroup from '@common/entities/auth/accessgroup.entity';

@Injectable()
export class ProjectService {
    private config: AccessGroupConfig;

    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userservice: UserService,
        @InjectRepository(ProjectAccess)
        private projectAccessRepository: Repository<ProjectAccess>,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        private configService: ConfigService,
        private readonly dataSource: DataSource,
    ) {
        this.config = this.configService.get('accessConfig');
    }

    async findAll(
        auth: AuthRes,
        skip: number,
        take: number,
        sortBy: string,
        descending: boolean,
        searchParams: Map<string, string>,
    ): Promise<[Project[], number]> {
        // convert take and skip to numbers
        take = Number(take);
        skip = Number(skip);

        const dbUser = await this.userRepository.findOne({
            where: { uuid: auth.user.uuid },
        });

        let baseQuery = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.missions', 'missions');

        // if not admin, only show projects that the user has access to
        if (dbUser.role !== UserRole.ADMIN) {
            baseQuery = baseQuery
                .leftJoin('project.project_accesses', 'projectAccesses')
                .leftJoin('projectAccesses.accessGroup', 'accessGroup')
                .leftJoin('accessGroup.accessGroupUsers', 'accessGroupUsers')
                .leftJoin('accessGroupUsers.user', 'user')
                .where('projectAccesses.rights >= :rights', {
                    rights: AccessGroupRights.READ,
                })
                .andWhere('user.uuid = :uuid', { uuid: auth.user.uuid });
        }

        // add sorting
        if (
            sortBy &&
            ['name', 'createdAt', 'updatedAt', 'creator'].includes(sortBy) // SQL Sanitization
        ) {
            baseQuery = baseQuery.orderBy(
                `project.${sortBy}`,
                descending ? 'DESC' : 'ASC',
            );
        }

        if (searchParams) {
            Object.keys(searchParams).forEach((key, index) => {
                if (!['name', 'creator.uuid'].includes(key)) {
                    return;
                }
                if (key.toLowerCase().includes('uuid')) {
                    baseQuery = baseQuery.andWhere(
                        `project.${key} = :${index}`,
                        {
                            [index]: searchParams[key],
                        },
                    );
                } else {
                    baseQuery = baseQuery.andWhere(
                        `project.${key} ILIKE :${index}`,
                        {
                            [index]: `%${searchParams[key]}%`,
                        },
                    );
                }
            });
        }

        return baseQuery.skip(skip).take(take).getManyAndCount();
    }

    async findOne(uuid: string): Promise<Project> {
        return this.projectRepository
            .createQueryBuilder('project')
            .where('project.uuid = :uuid', { uuid })
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.missions', 'missions')
            .leftJoinAndSelect('project.requiredTags', 'requiredTags')
            .leftJoinAndSelect('project.project_accesses', 'project_accesses')
            .leftJoinAndSelect('project_accesses.accessGroup', 'accessGroup')
            .leftJoinAndSelect(
                'accessGroup.accessGroupUsers',
                'accessGroupUsers',
            )
            .leftJoinAndSelect('accessGroupUsers.user', 'user')
            .getOne();
    }

    async findOneByName(name: string): Promise<Project> {
        return this.projectRepository.findOne({
            where: { name },
            relations: ['requiredTags'],
        });
    }

    async getRecentProjects(take: number, user: User): Promise<Project[]> {
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
            .map((project) => {
                return {
                    name: project['project_name'] as string,
                    uuid: project['project_uuid'] as string,
                    description: project['project_description'] as string,
                    creator: undefined,
                    requiredTags: [],
                    latestUpdate: project['latestUpdate'] as Date,
                    missions: [],
                    categories: [],
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    project_accesses: [],
                    createdAt: project['project_createdAt'] as Date,
                };
            })
            .sort(
                (a, b) => b.latestUpdate.getTime() - a.latestUpdate.getTime(),
            );
    }

    async create(project: CreateProject, auth: AuthRes): Promise<Project> {
        const exists = await this.projectRepository.exists({
            where: { name: ILike(project.name) },
        });
        if (exists) {
            throw new ConflictException(
                'Project with that name already exists',
            );
        }
        const creator = await this.userservice.findOneByUUID(auth.user.uuid);
        const accessGroupUsersDefault = creator.accessGroupUsers.filter(
            (accessGroupUser) =>
                accessGroupUser.accessGroup.personal ||
                accessGroupUser.accessGroup.inheriting,
        );

        const defaultAccessGroups = accessGroupUsersDefault.map(
            (ag) => ag.accessGroup,
        );

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

        const accessGroupsDefaultIds = defaultAccessGroups.map((ag) => ag.uuid);

        let deduplicatedAccessGroups = [];
        if (project.accessGroups) {
            deduplicatedAccessGroups = project.accessGroups.filter((ag) => {
                if ('accessGroupUUID' in ag) {
                    return !accessGroupsDefaultIds.includes(ag.accessGroupUUID);
                } else {
                    return ag.userUUID !== auth.user.uuid;
                }
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
        return this.projectRepository.findOneOrFail({
            where: { uuid: transactedProject.uuid },
            relations: ['creator', 'project_accesses'],
        });
    }

    async update(
        uuid: string,
        project: { name: string; description: string },
    ): Promise<Project> {
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
        return this.projectRepository.findOne({ where: { uuid } });
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
        const missionCount = project.missions.length;
        if (missionCount > 0) {
            throw new ConflictException(
                'Project has ' +
                    missionCount +
                    ' missions. Please delete them first.',
            );
        }

        await this.projectRepository.delete(uuid);
    }

    async createDefaultAccessGroups(
        manager: EntityManager,
        accessGroups: AccessGroup[],
        project: Project,
        removedDefaultGroups: string[],
    ) {
        return await Promise.all(
            accessGroups.map(async (accessGroup) => {
                let rights = AccessGroupRights.WRITE;
                if (accessGroup.inheriting) {
                    if (removedDefaultGroups.includes(accessGroup.uuid)) {
                        return;
                    }
                    rights = this.config.access_groups.find((group) => {
                        return group.uuid === accessGroup.uuid;
                    }).rights;
                } else if (accessGroup.personal) {
                    rights = AccessGroupRights.DELETE;
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
                                accessGroupUsers: {
                                    user: [
                                        {
                                            uuid: accessGroup.userUUID,
                                        },
                                    ],
                                },
                                personal: true,
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

    async getDefaultRights(auth: AuthRes) {
        const creator = await this.userservice.findOneByUUID(auth.user.uuid);
        const rights = creator.accessGroupUsers
            .map((agu) => agu.accessGroup)
            .filter(
                (accessGroup) => accessGroup.personal || accessGroup.inheriting,
            );
        return Promise.all(
            rights.map(async (right) => {
                const name = right.name;
                let memberCount = 1;
                let _rights = AccessGroupRights.WRITE;
                if (right.inheriting) {
                    _rights = this.config.access_groups.find(
                        (group) => group.uuid === right.uuid,
                    ).rights;
                    memberCount = await this.userservice.getMemberCount(
                        right.uuid,
                    );
                } else if (right.personal) {
                    _rights = AccessGroupRights.DELETE;
                }
                return {
                    name,
                    uuid: right.uuid,
                    memberCount,
                    rights: _rights,
                };
            }),
        );
    }
}
