import { Injectable } from '@nestjs/common';
import Project from './entities/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';

@Injectable()
export class ProjectService {
    constructor(
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
    ) {}

    async findAll(): Promise<Project[]> {
        logger.debug('Finding all projects');
        return this.projectRepository.find({ relations: ['creator', 'runs'] });
    }

    async findOne(uuid: string): Promise<Project> {
        return this.projectRepository.findOne({
            where: { uuid },
            relations: ['creator', 'runs'],
        });
    }

    async findOneByName(name: string): Promise<Project> {
        return this.projectRepository.findOne({ where: { name } });
    }

    async create(project: CreateProject, user: JWTUser): Promise<Project> {
        const creator = await this.userRepository.findOneOrFail({
            where: { googleId: user.userId },
        });
        const newProject = this.projectRepository.create({
            ...project,
            creator: creator,
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
