import { CreateMission } from '@common/api/types/create-mission.dto';
import {
    FlatMissionDto,
    MinimumMissionsDto,
    MissionsDto,
    MissionWithFilesDto,
} from '@common/api/types/mission/mission.dto';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import User from '@common/entities/user/user.entity';
import { UserRole } from '@common/frontend_shared/enum';
import {
    addTagsToMinioObject,
    externalMinio,
    getBucketFromFileType,
} from '@common/minio-helper';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import {
    addAccessConstraints,
    addAccessConstraintsToMissionQuery,
} from '../endpoints/auth/auth-helper';
import { AuthHeader } from '../endpoints/auth/parameter-decorator';
import logger from '../logger';
import {
    missionEntityToDtoWithCreator,
    missionEntityToDtoWithFiles,
    missionEntityToFlatDto,
    missionEntityToMinimumDto,
} from '../serialization';
import { TagService } from './tag.service';
import { UserService } from './user.service';
import { addMissionFilters, addProjectFilters, addSort } from './utilities';

import { SortOrder } from '@common/api/types/pagination';

const FIND_MANY_SORT_KEYS = {
    missionName: 'mission.name',
    projectName: 'project.name',
    creatorName: 'user.name',
    createdAt: 'mission.createdAt',
    updatedAt: 'mission.updatedAt',
};

@Injectable()
export class MissionService {
    constructor(
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private userService: UserService,
        private tagService: TagService,
    ) {}

    async create(
        createMission: CreateMission,
        auth: AuthHeader,
    ): Promise<FlatMissionDto> {
        const creator = await this.userService.findOneByUUID(
            auth.user.uuid,
            {},
            {},
        );
        const project = await this.projectRepository.findOneOrFail({
            where: { uuid: createMission.projectUUID },
            relations: ['requiredTags'],
        });
        if (!createMission.ignoreTags) {
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
                    `All required tags must be provided for the mission. Missing tags: ${
                        missingTagNames
                    }`,
                );
            } else {
                logger.info('All required tags are provided');
            }
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
                    return this.tagService.addTagType(
                        newMission.uuid,
                        tagTypeUUID,
                        value,
                    );
                },
            ),
        );
        return this.missionRepository
            .findOneOrFail({
                where: { uuid: newMission.uuid },
                relations: ['project', 'creator'],
            })
            .then((m) => missionEntityToFlatDto(m));
    }

    async findOne(uuid: string): Promise<MissionWithFilesDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: [
                'project',
                'creator',
                'tags',
                'files',
                'files.creator',
                'files.mission', // TODO: we can remove this property
                'files.mission.creator', // TODO: we can remove this property
                'files.mission.project', // TODO: we can remove this property
                'tags.tagType',
                'project.requiredTags',
            ],
        });

        return missionEntityToDtoWithFiles(mission);
    }

    async findMany(
        projectUuids: string[],
        projectPatterns: string[],
        missionUuids: string[],
        missionPatterns: string[],
        missionMetadata: Record<string, string>,
        sortBy: string | undefined,
        sortOrder: SortOrder,
        skip: number,
        take: number,
        userUuid: string,
    ): Promise<MissionsDto> {
        let query = this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .leftJoinAndSelect('mission.tags', 'tag')
            .leftJoinAndSelect('tag.tagType', 'tagType');

        query = addAccessConstraintsToMissionQuery(query, userUuid);

        query = addProjectFilters(
            query,
            this.projectRepository,
            projectUuids,
            projectPatterns,
        );

        query = addMissionFilters(
            query,
            this.missionRepository,
            missionUuids,
            missionPatterns,
            missionMetadata,
        );

        if (sortBy !== undefined) {
            query = addSort(query, FIND_MANY_SORT_KEYS, sortBy, sortOrder);
        }

        query.take(take).skip(skip);
        const [missions, count] = await query.getManyAndCount();

        return {
            data: missions.map((element) => missionEntityToFlatDto(element)),
            count,
            skip,
            take,
        };
    }

    async findMissionByProjectMinimal(
        userUUID: string,
        projectUUID: string,
        skip: number,
        take: number,
        search?: string,
        sortDirection?: 'ASC' | 'DESC',
        sortBy?: string,
    ): Promise<MinimumMissionsDto> {
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
            query.orderBy(`mission.${sortBy}`, sortDirection);
        }
        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(query, userUUID);
        }
        const [missions, count] = await query.getManyAndCount();

        return {
            data: missions.map((element) => missionEntityToMinimumDto(element)),
            count,
            skip,
            take,
        };
    }

    async findMissionByProject(
        user: User,
        projectUuid: string,
        skip: number,
        take: number,
        search?: string,
        sortDirection?: 'ASC' | 'DESC',
        sortBy?: string,
    ): Promise<MissionsDto> {
        const query = this.missionRepository
            .createQueryBuilder('mission')
            .addSelect('COUNT(files.uuid)::int', 'fileCount')
            .addSelect('COALESCE(SUM(files.size), 0)::bigint', 'totalSize')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .leftJoin('mission.files', 'files')
            .leftJoinAndSelect('mission.tags', 'tags')
            .leftJoinAndSelect('tags.tagType', 'tagType')
            .where('project.uuid = :projectUuid', { projectUuid })
            .take(take)
            .skip(skip);

        query
            .addGroupBy('mission.uuid')
            .addGroupBy('project.uuid')
            .addGroupBy('project.name')
            .addGroupBy('creator.uuid')
            .addGroupBy('tags.uuid')
            .addGroupBy('tagType.uuid');

        if (search) {
            query.andWhere('mission.name ILIKE :search', {
                search: `%${search}%`,
            });
        }
        if (sortBy) {
            query.orderBy(`mission.${sortBy}`, sortDirection);
        }
        if (user.role !== UserRole.ADMIN) {
            addAccessConstraints(query, user.uuid);
        }

        const count = await query.getCount();
        const { raw, entities } = await query.getRawAndEntities();

        // this is necessary as raw and entities at not of the same length / order
        // eslint-disable-next-line unicorn/no-array-reduce
        const rawLookup = raw.reduce(
            (lookup: Record<string, any>, rawEntry: any) => {
                lookup[rawEntry.mission_uuid] = rawEntry;
                return lookup;
            },
            {},
        );

        return {
            data: entities.map((m) => {
                const rawEntry = rawLookup[m.uuid];
                return {
                    ...missionEntityToDtoWithCreator(m),
                    filesCount: rawEntry?.fileCount,
                    size: Number.parseInt(rawEntry?.totalSize),
                };
            }),
            count,
            skip,
            take,
        };
    }

    async moveMission(missionUUID: string, projectUUID: string): Promise<void> {
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

        await this.missionRepository.update(missionUUID, {
            project: project,
        });

        if (mission.files === undefined) throw new Error('Files not loaded');

        await Promise.all(
            mission.files.map(async (file) =>
                addTagsToMinioObject(
                    getBucketFromFileType(file.type),
                    file.uuid,
                    {
                        filename: file.filename,
                        missionUuid: missionUUID,
                        projectUuid: projectUUID,
                    },
                ),
            ),
        );
    }

    async deleteMission(uuid: string): Promise<void> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid },
            relations: ['files'],
        });
        if (mission.files === undefined) throw new Error('Files not loaded');

        if (mission.files.length > 0) {
            throw new ConflictException(
                'Mission cannot be deleted because it contains files',
            );
        }
        await this.missionRepository.remove(mission);
    }

    async updateTags(
        missionUUID: string,
        tags: Record<string, string>,
    ): Promise<void> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['tags', 'tags.tagType'],
        });

        if (mission.tags === undefined) throw new Error('Tags not loaded');

        await Promise.all(
            Object.entries(tags).map(async ([tagTypeUUID, value]) => {
                const tag = mission.tags?.find(
                    (_tag) => _tag.tagType?.uuid === tagTypeUUID,
                );
                if (tag) {
                    return this.tagService.updateTagType(
                        missionUUID,
                        tagTypeUUID,
                        value,
                    );
                }
                return this.tagService.addTagType(
                    missionUUID,
                    tagTypeUUID,
                    value,
                );
            }),
        );
    }

    async download(missionUUID: string) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['files', 'project'],
        });

        if (mission.files === undefined) throw new Error('Files not loaded');

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
