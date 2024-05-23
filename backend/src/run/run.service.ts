import { Injectable } from '@nestjs/common';
import Run from './entities/run.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateRun } from './entities/create-run.dto';
import Project from '../project/entities/project.entity';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';

@Injectable()
export class RunService {
  constructor(
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    @InjectRepository(User) private userRepository: Repository<User>,
  ) {}

  async create(createRun: CreateRun, user: JWTUser): Promise<Run> {
    const creator = await this.userRepository.findOneOrFail({
      where: { googleId: user.userId },
    });
    const project = await this.projectRepository.findOneOrFail({
      where: { uuid: createRun.projectUUID },
    });
    const run = this.runRepository.create({
      name: createRun.name,
      project: project,
      creator,
    });
    const newRun = await this.runRepository.save(run);
    return this.runRepository.findOneOrFail({ where: { uuid: newRun.uuid } });
  }

  async findRunByProject(projectUUID: string): Promise<Run[]> {
    return this.runRepository.find({
      where: { project: { uuid: projectUUID } },
      relations: ['project', 'files'],
    });
  }

  async filteredByProjectName(projectName: string): Promise<Run[]> {
    const project = await this.projectRepository.findOneOrFail({
      where: { name: projectName },
      relations: ['runs', 'runs.project'],
    });
    return project.runs;
  }

  async findAll(): Promise<Run[]> {
    return this.runRepository.find({ relations: ['project'] });
  }

  async findOneByName(name: string): Promise<Run> {
    return this.runRepository.findOne({ where: { name } });
  }
}
