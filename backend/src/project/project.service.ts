import { ConflictException, Injectable } from '@nestjs/common';
import Project from '@common/entities/project/project.entity';
import { Repository } from 'typeorm';
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
        private configService: ConfigService,
    ) {
        this.config = this.configService.get('accessConfig');
    }

    async findAll(user: JWTUser): Promise<Project[]> {
        logger.debug('Finding all projects as user: ', user.uuid);
        const db_user = await this.userRepository.findOne({
            where: { uuid: user.uuid },
        });
        if (db_user.role === UserRole.ADMIN) {
            return this.projectRepository.find({
                relations: ['creator', 'missions'],
            });
        }

        return this.projectRepository
            .createQueryBuilder('project')
            .leftJoinAndSelect('project.creator', 'creator')
            .leftJoinAndSelect('project.missions', 'missions')
            .leftJoin('project.project_accesses', 'projectAccesses')
            .leftJoin('projectAccesses.accessGroup', 'accessGroup')
            .leftJoin('accessGroup.users', 'users')
            .where('projectAccesses.rights >= :rights', {
                rights: AccessGroupRights.READ,
            })
            .andWhere('users.uuid = :uuid', { uuid: user.uuid })
            .getMany();
    }

    async findOne(uuid: string): Promise<Project> {
        return this.projectRepository.findOne({
            where: { uuid },
            relations: ['creator', 'missions', 'requiredTags'],
        });
    }

    async findOneByName(name: string): Promise<Project> {
        return this.projectRepository.findOne({ where: { name } });
    }

    async create(project: CreateProject, user: JWTUser): Promise<Project> {
        const exists = await this.projectRepository.exists({
            where: { name: project.name },
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
        const savedProject = await this.projectRepository.save(newProject);
        await Promise.all(
            access_groups_default.map(async (accessGroup) => {
                let rights = AccessGroupRights.WRITE;
                if (accessGroup.inheriting) {
                    rights = this.config.access_groups.find((group) => {
                        return group.uuid === accessGroup.uuid;
                    }).rights;
                }
                const projectAccess = this.projectAccessRepository.create({
                    rights,
                    accessGroup,
                    projects: savedProject,
                });
                return this.projectAccessRepository.save(projectAccess);
            }),
        );
        return this.projectRepository.findOneOrFail({
            where: { uuid: savedProject.uuid },
            relations: ['creator', 'project_accesses'],
        });
    }

    async update(
        uuid: string,
        project: { name: string; description: string },
    ): Promise<Project> {
        await this.projectRepository.update(uuid, project);
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

    async removeTagType(uuid: string, tagTypeUUID: string): Promise<Project> {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid },
        });
        project.requiredTags = project.requiredTags.filter(
            (tagType) => tagType.uuid !== tagTypeUUID,
        );
        return this.projectRepository.save(project);
    }

    async remove(uuid: string): Promise<void> {
        await this.projectRepository.delete(uuid);
    }

    async clearProjects(): Promise<void> {
        await this.projectRepository.query('DELETE FROM "project"');
    }

    async deleteProject(uuid: string): Promise<void> {
        await this.projectRepository.delete(uuid);
    }
}
