import { Injectable } from '@nestjs/common';
import Mission from '@common/entities/mission/mission.entity';
import { Brackets, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMission } from './entities/create-mission.dto';
import Project from '@common/entities/project/project.entity';
import { JWTUser } from '../auth/paramDecorator';
import User from '@common/entities/user/user.entity';
import { moveRunFilesInMinio } from '../minioHelper';
import { UserService } from '../user/user.service';
import { FileType, UserRole } from '@common/enum';
import Tag from '@common/entities/tag/tag.entity';
import { TagService } from '../tag/tag.service';
import env from '@common/env';
import { addAccessJoinsAndConditions } from '../auth/authHelper';

@Injectable()
export class MissionService {
    constructor(
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userservice: UserService,
        private tagservice: TagService,
    ) {}

    async create(
        createMission: CreateMission,
        user: JWTUser,
    ): Promise<Mission> {
        const creator = await this.userservice.findOneByUUID(user.uuid);
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: createMission.projectUUID },
        });
        const mission = this.missionRepository.create({
            name: createMission.name,
            project: project,
            creator,
        });
        const newMission = await this.missionRepository.save(mission);
        await Promise.all(
            Object.entries(createMission.tags).map(
                async ([tagTypeUUID, value]) => {
                    return this.tagservice.addTagType(
                        newMission.uuid,
                        tagTypeUUID,
                        value,
                    );
                },
            ),
        );
        return this.missionRepository.findOneOrFail({
            where: { uuid: newMission.uuid },
        });
    }

    async findOne(uuid: string): Promise<Mission> {
        return this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: ['project', 'files', 'creator', 'tags', 'tags.tagType'],
        });
    }

    async findMissionByProject(
        projectUUID: string,
        skip: number,
        take: number,
        search?: string,
        descending?: boolean,
        sortBy?: string,
    ): Promise<Mission[]> {
        const query = this.missionRepository.createQueryBuilder('mission')
          .leftJoinAndSelect('mission.project', 'project')
          .leftJoinAndSelect('mission.creator', 'creator')
          .leftJoinAndSelect('mission.files', 'files')
          .leftJoinAndSelect('files.creator', 'fileCreator')
          .where('project.uuid = :projectUUID', { projectUUID })
          .take(take)
          .skip(skip);

        if (search) {
            query.andWhere('mission.name ILIKE :search', {search: `%${search}%`});
        }
        if(sortBy) {
            query.orderBy(`mission.${sortBy}`, descending ? 'DESC' : 'ASC');
        }
        return query.getMany();

    }

    async filteredByProjectName(
        projectName: string,
        userUUID: string,
        skip: number,
        take: number,
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
        return addAccessJoinsAndConditions(
            this.missionRepository
                .createQueryBuilder('mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('mission.creator', 'creator')
                .where('project.name = :name', { name: projectName })
                .andWhere(
                    new Brackets((qb) => {
                        qb.where('projectUsers.uuid = :user', {
                            user: userUUID,
                        }).orWhere('missionUsers.uuid = :user', {
                            user: userUUID,
                        });
                    }),
                ),
            userUUID,
        )
            .take(take)
            .skip(skip)
            .getMany();
    }

    // TODO Test!
    async findAll(
        userUUID: string,
        skip: number,
        take: number,
    ): Promise<Mission[]> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.missionRepository.find({
                relations: ['project', 'creator'],
                skip,
                take,
            });
        }
        return addAccessJoinsAndConditions(
            this.missionRepository
                .createQueryBuilder('mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('mission.creator', 'creator'),
            userUUID,
        )
            .skip(skip)
            .take(take)
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
            env.MINIO_BAG_BUCKET_NAME,
        );
        await moveRunFilesInMinio(
            `${old_project.name}/${mission.name}`,
            mission.project.name,
            env.MINIO_MCAP_BUCKET_NAME,
        );
        return this.missionRepository.save(mission);
    }
}
