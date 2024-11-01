import { ConflictException, Injectable } from '@nestjs/common';
import Mission from '@common/entities/mission/mission.entity';
import { Brackets, ILike, In, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateMission } from './entities/create-mission.dto';
import Project from '@common/entities/project/project.entity';
import { AuthRes } from '../auth/paramDecorator';
import User from '@common/entities/user/user.entity';
import { UserService } from '../user/user.service';
import { UserRole } from '@common/enum';
import { TagService } from '../tag/tag.service';
import { addAccessConstraints } from '../auth/authHelper';
import TagType from '@common/entities/tagType/tagType.entity';
import {
    addTagsToMinioObject,
    externalMinio,
    getBucketFromFileType,
} from '@common/minio_helper';
import logger from '../logger';

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
        auth: AuthRes,
    ): Promise<Mission> {
        const creator = await this.userservice.findOneByUUID(auth.user.uuid);
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: createMission.projectUUID },
            relations: ['requiredTags'],
        });

        const missingTags = project.requiredTags.filter(
            (tagType: TagType) =>
                createMission.tags[tagType.uuid] === undefined &&
                createMission.tags[tagType.uuid] === '' &&
                createMission.tags[tagType.uuid] === null,
        );
        if (missingTags.length > 0) {
            const missingTagNames = missingTags
                .map((tagType: TagType) => tagType.name)
                .join(', ');
            throw new ConflictException(
                'All required tags must be provided for the mission. Missing tags: ' +
                    missingTagNames,
            );
        } else {
            logger.info('All required tags are provided');
        }

        // verify that the no mission with the same name exists in the project
        const exists = await this.missionRepository.exists({
            where: {
                name: createMission.name,
                project: {
                    uuid: createMission.projectUUID,
                },
            },
        });
        if (exists) {
            throw new ConflictException(
                `Mission with that name already exists in the project '${project.name}'`,
            );
        }

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
            relations: [
                'project',
                'creator',
                'tags',
                'tags.tagType',
                'project.requiredTags',
            ],
        });
    }

    async findMissionByProjectMinimal(
        projectUUID: string,
        skip: number,
        take: number,
        search?: string,
        descending?: boolean,
        sortBy?: string,
        userUUID?: string,
    ): Promise<[Mission[], number]> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const query = this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .where('project.uuid = :projectUUID', { projectUUID })
            .take(take)
            .skip(skip);

        if (search) {
            query.andWhere('mission.name ILIKE :search', {
                search: `%${search}%`,
            });
        }
        if (sortBy) {
            query.orderBy(`mission.${sortBy}`, descending ? 'DESC' : 'ASC');
        }
        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(query, userUUID);
        }
        return query.getManyAndCount();
    }

    async findMissionByProject(
        projectUUID: string,
        skip: number,
        take: number,
        search?: string,
        descending?: boolean,
        sortBy?: string,
        userUUID?: string,
    ): Promise<[Mission[], number]> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const query = this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .leftJoinAndSelect('mission.files', 'files')
            .leftJoinAndSelect('mission.tags', 'tags')
            .leftJoinAndSelect('tags.tagType', 'tagType')
            .leftJoinAndSelect('files.creator', 'fileCreator')
            .where('project.uuid = :projectUUID', { projectUUID })
            .take(take)
            .skip(skip);

        if (search) {
            query.andWhere('mission.name ILIKE :search', {
                search: `%${search}%`,
            });
        }
        if (sortBy) {
            query.orderBy(`mission.${sortBy}`, descending ? 'DESC' : 'ASC');
        }
        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(query, userUUID);
        }
        return query.getManyAndCount();
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
        return addAccessConstraints(
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
        return addAccessConstraints(
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

    async moveMission(missionUUID: string, projectUUID: string) {
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: projectUUID },
        });

        // verify that the no mission with the same name exists in the project
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['files'],
        });

        const exists = await this.missionRepository.exists({
            where: { name: mission.name, project: project },
        });
        if (exists) {
            throw new ConflictException(
                'Mission with that name already exists in the project',
            );
        }

        const savedMission = await this.missionRepository.update(missionUUID, {
            project: project,
        });

        await Promise.all(
            mission.files.map(async (file) =>
                addTagsToMinioObject(
                    getBucketFromFileType(file.type),
                    file.uuid,
                    {
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        mission_uuid: missionUUID,
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        project_uuid: projectUUID,
                    },
                ),
            ),
        );

        return savedMission;
    }

    async findOneByName(
        name: string,
        projectUuid: string,
    ): Promise<Mission | undefined> {
        return this.missionRepository.findOne({
            where: {
                name,
                project: {
                    uuid: projectUuid,
                },
            },
        });
    }

    async deleteMission(uuid: string): Promise<Mission> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: ['files'],
        });
        if (mission.files.length > 0) {
            throw new ConflictException(
                'Mission cannot be deleted because it contains files',
            );
        }
        await this.missionRepository.remove(mission);
        return mission;
    }

    async updateTags(missionUUID: string, tags: Record<string, string>) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['tags', 'tags.tagType'],
        });
        await Promise.all(
            Object.entries(tags).map(async ([tagTypeUUID, value]) => {
                const tag = mission.tags.find(
                    (_tag) => _tag.tagType.uuid === tagTypeUUID,
                );
                if (tag) {
                    return this.tagservice.updateTagType(
                        missionUUID,
                        tagTypeUUID,
                        value,
                    );
                }
                return this.tagservice.addTagType(
                    missionUUID,
                    tagTypeUUID,
                    value,
                );
            }),
        );
    }

    async findMany(uuids: string[]): Promise<Mission[]> {
        return this.missionRepository.find({
            where: { uuid: In(uuids) },
            relations: ['project', 'creator'],
        });
    }

    async download(missionUUID: string) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['files', 'project'],
        });
        return await Promise.all(
            mission.files.map(async (f) => ({
                filename: f.filename,
                link: await externalMinio.presignedUrl(
                    'GET',
                    getBucketFromFileType(f.type),
                    f.uuid,
                    4 * 60 * 60,
                    {
                        // set filename in response headers
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'response-content-disposition': `attachment; filename ="${f.filename}"`,
                    },
                ),
            })),
        );
    }

    async updateName(uuid: string, name: string) {
        const exists = await this.missionRepository.exists({
            where: { name: ILike(name), uuid: Not(uuid) },
        });
        if (exists) {
            throw new ConflictException(
                'Mission with that name already exists',
            );
        }
        await this.missionRepository.update(uuid, {
            name: name,
        });
        return this.missionRepository.findOne({ where: { uuid } });
    }
}
