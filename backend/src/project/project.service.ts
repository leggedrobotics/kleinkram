import { ConflictException, Injectable } from '@nestjs/common';
import Project from './entities/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

import AccessGroup from '../auth/entities/accessgroup.entity';
import { AccessGroupRights, UserRole } from '../enum';

@Injectable()
export class ProjectService {
    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userservice: UserService,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
    ) {}

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
            .leftJoin('project.accessGroups', 'accessGroups')
            .leftJoin('accessGroups.users', 'users')
            .where('accessGroups.rights >= :rights', {
                rights: AccessGroupRights.READ,
            })
            .andWhere('users.uuid = :uuid', { uuid: user.uuid })
            .getMany();
    }

    async findOne(uuid: string): Promise<Project> {
        return this.projectRepository.findOne({
            where: { uuid },
            relations: ['creator', 'missions'],
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

        const newProject = this.projectRepository.create({
            ...project,
            creator: creator,
            accessGroups: access_groups_default,
        });
        return this.projectRepository.save(newProject);
    }

    async update(uuid: string, project: CreateProject): Promise<Project> {
        await this.projectRepository.update(uuid, project);
        return this.projectRepository.findOne({ where: { uuid } });
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
