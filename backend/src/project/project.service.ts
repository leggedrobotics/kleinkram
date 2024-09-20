import { ConflictException, Injectable } from '@nestjs/common';
import Project from '@common/entities/project/project.entity';
import { DataSource, EntityManager, ILike, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '@common/entities/user/user.entity';
import { UserService } from '../user/user.service';

import { AccessGroupRights, UserRole } from '@common/enum';
import TagType from '@common/entities/tagType/tagType.entity';
import ProjectAccess from '@common/entities/auth/project_access.entity';
import { ConfigService } from '@nestjs/config';
import { AccessGroupConfig } from '../app.module';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { moveMissionFilesInMinio } from '../minioHelper';
import env from '@common/env';

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
        user: JWTUser,
        skip: number,
        take: number,
        sortBy: string,
        descending: boolean,
        searchParams: Map<string, string>,
    ): Promise<[Project[], number]> {
        // convert take and skip to numbers
        take = Number(take);
        skip = Number(skip);

        logger.debug('Finding all projects as user: ', user.uuid);
        logger.debug('Skip ' + skip + ' Take ' + take);

        const db_user = await this.userRepository.findOne({
            where: { uuid: user.uuid },
        });

        let baseQuery = this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.missions', 'missions');

        // if not admin, only show projects that the user has access to
        if (db_user.role !== UserRole.ADMIN) {
            baseQuery = baseQuery
                .leftJoin('project.project_accesses', 'projectAccesses')
                .leftJoin('projectAccesses.accessGroup', 'accessGroup')
                .leftJoin('accessGroup.users', 'users')
                .where('projectAccesses.rights >= :rights', {
                    rights: AccessGroupRights.READ,
                })
                .andWhere('users.uuid = :uuid', { uuid: user.uuid });
        }

        // add sorting
        if (
            sortBy &&
            ['name', 'createdAt', 'updatedAt', 'creator'].includes(sortBy) // SQL Sanitization
        ) {
            console.log('Sorting by ' + sortBy + ' descending: ' + descending);
            baseQuery = baseQuery.orderBy(
                `project.${sortBy}`,
                descending ? 'DESC' : 'ASC',
            );
        }

        if (!!searchParams) {
            console.log('Searching for: ' + searchParams);
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
            .leftJoinAndSelect('accessGroup.users', 'users')
            .getOne();
    }

    async findOneByName(name: string): Promise<Project> {
        return this.projectRepository.findOne({
            where: { name },
            relations: ['requiredTags'],
        });
    }

    async create(project: CreateProject, user: JWTUser): Promise<Project> {
        const exists = await this.projectRepository.exists({
            where: { name: ILike(project.name) },
        });
        if (exists) {
            throw new ConflictException(
                'Project with that name already exists',
            );
        }
        const creator = await this.userservice.findOneByUUID(user.uuid);
        const access_groups_default = creator.accessGroups.filter(
            (accessGroup) => accessGroup.personal || accessGroup.inheriting,
        );
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
        const transactedProject = await this.dataSource.transaction(
            async (manager) => {
                const savedProject = await manager.save(Project, newProject);
                await this.createDefaultAccessGroups(
                    manager,
                    access_groups_default,
                    savedProject,
                );

                if (project.accessGroups) {
                    await this.createSpecifiedAccessGroups(
                        manager,
                        project.accessGroups,
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
        const db_project = await this.projectRepository.findOneOrFail({
            where: { uuid },
            relations: ['missions'],
        });
        const exists = await this.projectRepository.exists({
            where: { name: ILike(project.name), uuid: Not(uuid) },
        });
        if (exists) {
            throw new ConflictException(
                'Project with that name already exists',
            );
        }
        if (db_project.name !== project.name) {
            await Promise.all(
                db_project.missions.map(async (mission) => {
                    await moveMissionFilesInMinio(
                        `${db_project.name}/${mission.name}`,
                        `${project.name}`,
                        env.MINIO_BAG_BUCKET_NAME,
                    );
                    await moveMissionFilesInMinio(
                        `${db_project.name}/${mission.name}`,
                        `${project.name}`,
                        env.MINIO_MCAP_BUCKET_NAME,
                    );
                }),
            );
        }
        console.log('updating: ', project.name, project.description);
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
    ) {
        return await Promise.all(
            accessGroups.map(async (accessGroup) => {
                let rights = AccessGroupRights.WRITE;
                if (accessGroup.inheriting) {
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
                                users: [
                                    {
                                        uuid: accessGroup.userUUID,
                                    },
                                ],
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
}
