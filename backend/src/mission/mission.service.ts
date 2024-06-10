import { Injectable } from '@nestjs/common';
import Mission from './entities/mission.entity';
import { Repository, Brackets } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMission } from './entities/create-mission.dto';
import Project from '../project/entities/project.entity';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';
import { moveRunFilesInMinio } from '../minioHelper';
import { UserService } from '../user/user.service';
import { UserRole } from '../enum';

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

    async create(createRun: CreateMission, user: JWTUser): Promise<Mission> {
        const creator = await this.userservice.findOneByUUID(user.uuid);
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

    async findOne(uuid: string): Promise<Mission> {
        return this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: ['project', 'files', 'creator'],
        });
    }

    async findMissionByProject(projectUUID: string): Promise<Mission[]> {
        return await this.missionRepository.find({
            where: { project: { uuid: projectUUID } },
            relations: ['project', 'files', 'creator', 'files.creator'],
        });
    }

    async filteredByProjectName(
        projectName: string,
        userUUID: string,
    ): Promise<Mission[]> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            const project = await this.projectRepository.findOneOrFail({
                where: { name: projectName },
                relations: ['missions', 'missions.project', 'missions.creator'],
            });
            return project.missions;
        }
        return this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .leftJoin('project.accessGroups', 'projectAccessGroups')
            .leftJoin('projectAccessGroups.users', 'projectUsers')
            .leftJoin('mission.accessGroups', 'missionAccessGroups')
            .leftJoin('missionAccessGroups.users', 'missionUsers')
            .where('project.name = :name', { name: projectName })
            .andWhere(
                new Brackets((qb) => {
                    qb.where('projectUsers.uuid = :user', {
                        user: userUUID,
                    }).orWhere('missionUsers.uuid = :user', { user: userUUID });
                }),
            )
            .getMany();
    }

    // TODO Test!
    async findAll(userUUID: string): Promise<Mission[]> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.missionRepository.find({ relations: ['project'] });
        }
        return this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoin('project.accessGroups', 'projectAccessGroups')
            .leftJoin('projectAccessGroups.users', 'projectUsers')
            .leftJoin('mission.accessGroups', 'missionAccessGroups')
            .leftJoin('missionAccessGroups.users', 'missionUsers')
            .where('projectUsers.uuid = :user', { user: userUUID })
            .orWhere('missionUsers.uuid = :user', { user: userUUID })
            .getMany();
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

    async clearMissions(): Promise<void> {
        await this.missionRepository.query('DELETE FROM "mission"');
    }

    async moveMission(
        missionUUID: string,
        projectUUID: string,
    ): Promise<Mission> {
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
