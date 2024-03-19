import { Injectable } from '@nestjs/common';
import Project from './entities/project.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateProject } from './entities/create-project.dto';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project) private projectRepository: Repository<Project>,
  ) {}

  async findAll(): Promise<Project[]> {
    return this.projectRepository.find();
  }

  async findOne(uuid: string): Promise<Project> {
    return this.projectRepository.findOne({ where: { uuid } });
  }

  async create(project: CreateProject): Promise<Project> {
    const newProject = this.projectRepository.create(project);
    return this.projectRepository.save(newProject);
  }

  async update(uuid: string, project: CreateProject): Promise<Project> {
    await this.projectRepository.update(uuid, project);
    return this.projectRepository.findOne({ where: { uuid } });
  }

  async remove(uuid: string): Promise<void> {
    await this.projectRepository.delete(uuid);
  }
}
