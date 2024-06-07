import { Injectable } from '@nestjs/common';
import Mission from './entities/mission.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateRun } from './entities/create-mission.dto';
import Project from '../project/entities/project.entity';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';
import { moveRunFilesInMinio } from '../minioHelper';
import { UserService } from '../user/user.service';

@Injectable()
export class MissionService {
    constructor(
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userservice: UserService,
    ) {}

    async create(createRun: CreateRun, user: JWTUser): Promise<Mission> {
        const creator = await this.userservice.findOneById(user.userId);
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: createRun.projectUUID },
        });
        const mission = this.missionRepository.create({
            name: createRun.name,
            project: project,
            creator,
        });
        const newRun = await this.missionRepository.save(mission);
        return this.missionRepository.findOneOrFail({
            where: { uuid: newRun.uuid },
        });
    }

    async findRunByProject(projectUUID: string): Promise<Mission[]> {
        return await this.missionRepository.find({
            where: { project: { uuid: projectUUID } },
            relations: ['project', 'files', 'creator', 'files.creator'],
        });
    }

    async filteredByProjectName(projectName: string): Promise<Mission[]> {
        const project = await this.projectRepository.findOneOrFail({
            where: { name: projectName },
            relations: ['missions', 'missions.project', 'missions.creator'],
        });
        return project.missions;
    }

    async findAll(): Promise<Mission[]> {
        return this.missionRepository.find({ relations: ['project'] });
    }

    async findOneByName(name: string): Promise<Mission> {
        return this.missionRepository.findOne({ where: { name } });
    }

    async findOneByUUID(uuid: string): Promise<Mission> {
        return this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: ['project', 'files', 'creator', 'files.topics'],
        });
    }

    async clearRuns(): Promise<void> {
        await this.missionRepository.query('DELETE FROM "mission"');
    }

    async moveRun(missionUUID: string, projectUUID: string): Promise<Mission> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const old_project = mission.project;
        mission.project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
        });
        await moveRunFilesInMinio(
            `${old_project.name}/${mission.name}`,
            mission.project.name,
        );
        return this.missionRepository.save(mission);
    }
}
