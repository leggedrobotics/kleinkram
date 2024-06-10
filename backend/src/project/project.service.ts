import { Injectable } from '@nestjs/common';
import Project from './entities/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class ProjectService {
    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userservice: UserService,
    ) {}

    async findAll(): Promise<Project[]> {
        logger.debug('Finding all projects');
        return this.projectRepository.find({
            relations: ['creator', 'missions'],
        });
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
        const creator = await this.userservice.findOneById(user.userId);
        console.log(creator.accessGroups);
        const personal_access_group = creator.accessGroups.find(
            (accessGroup) => accessGroup.personal,
        );
        console.log('personal_access_group', personal_access_group);
        const newProject = this.projectRepository.create({
            ...project,
            creator: creator,
            accessGroups: [personal_access_group],
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
