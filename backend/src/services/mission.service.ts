import {
    addAccessConstraints,
    addAccessConstraintsToMissionQuery,
} from '@/endpoints/auth/auth-helper';
import { AuthHeader } from '@/endpoints/auth/parameter-decorator';
import {
    missionEntityToDtoWithCreator,
    missionEntityToDtoWithFiles,
    missionEntityToFlatDto,
    missionEntityToMinimumDto,
} from '@/serialization';
import {
    CreateMission,
    FlatMissionDto,
    MinimumMissionsDto,
    MissionsDto,
    MissionWithFilesDto,
} from '@kleinkram/api-dto';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { TagTypeEntity } from '@kleinkram/backend-common/entities/tagType/tag-type.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { UserRole } from '@kleinkram/shared';
import {
    ConflictException,
    Inject,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, Not, QueryFailedError, Repository } from 'typeorm';
import logger from '../logger';
import { TagService } from './tag.service';
import { UserService } from './user.service';
import {
    addFileStats,
    addMissionFilters,
    addProjectFilters,
    addSort,
} from './utilities';

import { SortOrder } from '@kleinkram/api-dto';
import { IStorageBucket } from '@kleinkram/backend-common/modules/storage/types';

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
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        @InjectRepository(ProjectEntity)
        private projectRepository: Repository<ProjectEntity>,
        @InjectRepository(UserEntity)
        private userRepository: Repository<UserEntity>,
        private userService: UserService,
        private tagService: TagService,
        @Inject('DataStorageBucket')
        private readonly dataStorage: IStorageBucket,
        private readonly dataSource: DataSource,
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
                (tagType: TagTypeEntity) =>
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    createMission.tags[tagType.uuid] === undefined &&
                    createMission.tags[tagType.uuid] === '' &&
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                    createMission.tags[tagType.uuid] === null,
            );
            if (missingTags.length > 0) {
                const missingTagNames = missingTags
                    .map((tagType: TagTypeEntity) => tagType.name)
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
        let idQuery = this.missionRepository
            .createQueryBuilder('mission')
            .select('mission.uuid')
            .leftJoin('mission.project', 'project')
            .leftJoin('mission.creator', 'creator')
            .leftJoin('mission.tags', 'tag')
            .leftJoin('tag.tagType', 'tagType');

        idQuery = addAccessConstraintsToMissionQuery(idQuery, userUuid);

        idQuery = addProjectFilters(
            idQuery,
            this.projectRepository,
            projectUuids,
            projectPatterns,
        );

        idQuery = addMissionFilters(
            idQuery,
            this.missionRepository,
            missionUuids,
            missionPatterns,
            missionMetadata,
        );

        if (sortBy !== undefined) {
            idQuery = addSort(idQuery, FIND_MANY_SORT_KEYS, sortBy, sortOrder);
        }

        // Get distinct mission UUIDs
        idQuery.groupBy('mission.uuid');

        // Get count before pagination
        const count = await idQuery.getCount();
        idQuery.take(take).skip(skip);

        const missionIds = await idQuery.getRawMany();

        if (missionIds.length === 0) {
            return {
                data: [],
                count,
                skip,
                take,
            };
        }

        let dataQuery = this.missionRepository
            .createQueryBuilder('mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('mission.creator', 'creator')
            .leftJoinAndSelect('mission.tags', 'tag')
            .leftJoinAndSelect('tag.tagType', 'tagType')
            .where('mission.uuid IN (:...missionIds)', {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
                missionIds: missionIds.map((m) => m.mission_uuid),
            });

        if (sortBy !== undefined) {
            dataQuery = addSort(
                dataQuery,
                FIND_MANY_SORT_KEYS,
                sortBy,
                sortOrder,
            );
        }

        dataQuery = addFileStats(dataQuery);

        const result = await dataQuery.getRawAndEntities();
        const missions = result.entities;
        const rawResults = result.raw;

        // Create a map for quick lookup of file stats by mission UUID
        const statsMap = new Map<
            string,
            { fileCount: number; fileSize: number }
        >();
        for (const raw of rawResults) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const missionUuid = raw.mission_uuid;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            if (!statsMap.has(missionUuid)) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                statsMap.set(missionUuid, {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    fileCount: Number.parseInt(raw.fileCount) || 0,

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    fileSize: Number.parseInt(raw.fileSize) || 0,
                });
            }
        }

        // Assign file stats to missions
        for (const mission of missions) {
            const stats = statsMap.get(mission.uuid);
            if (stats) {
                mission.fileCount = stats.fileCount;
                mission.size = stats.fileSize;
            } else {
                mission.fileCount = 0;
                mission.size = 0;
            }
        }

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
            const tokens = search.trim().split(/\s+/);
            for (const [index, token] of tokens.entries()) {
                query.andWhere(`mission.name ILIKE :search_${String(index)}`, {
                    [`search_${String(index)}`]: `%${token}%`,
                });
            }
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
        user: UserEntity,
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
            const tokens = search.trim().split(/\s+/);
            for (const [index, token] of tokens.entries()) {
                query.andWhere(`mission.name ILIKE :search_${String(index)}`, {
                    [`search_${String(index)}`]: `%${token}%`,
                });
            }
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
        // eslint-disable-next-line unicorn/no-array-reduce, @typescript-eslint/no-unsafe-assignment
        const rawLookup = raw.reduce(
            (
                lookup: Record<string, unknown>,

                // eslint-disable-next-line @typescript-eslint/naming-convention
                rawEntry: { mission_uuid: string },
            ) => {
                lookup[rawEntry.mission_uuid] = rawEntry;
                return lookup;
            },
            {},
        );

        return {
            data: entities.map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                const rawEntry = rawLookup[m.uuid];
                return {
                    // eslint-disable-next-line @typescript-eslint/no-misused-spread
                    ...missionEntityToDtoWithCreator(m),

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                    filesCount: rawEntry?.fileCount,

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    size: Number.parseInt(rawEntry?.totalSize),
                };
            }),
            count,
            skip,
            take,
        };
    }

    async migrateMission(
        missionUUID: string,
        targetProjectUUID: string,
        newName?: string,
    ): Promise<void> {
        const targetProject = await this.projectRepository.findOne({
            where: { uuid: targetProjectUUID },
        });
        if (!targetProject) {
            throw new NotFoundException(
                `Project with UUID ${targetProjectUUID} not found`,
            );
        }

        let rollbackTags: {
            fileUUID: string;
            filename: string;
            missionUUID: string;
            projectUUID: string;
        }[] = [];

        try {
            await this.dataSource.transaction(async (manager) => {
                const missionRepository = manager.getRepository(MissionEntity);
                const mission = await missionRepository.findOne({
                    where: { uuid: missionUUID },
                    relations: ['files', 'project'],
                });
                if (!mission) {
                    throw new NotFoundException(
                        `Mission with UUID ${missionUUID} not found`,
                    );
                }
                if (mission.files === undefined) throw new Error('Files not loaded');
                if (mission.project === undefined)
                    throw new Error('Project not loaded');
                if (mission.project.uuid === targetProject.uuid) {
                    throw new ConflictException(
                        'Mission is already part of the target project',
                    );
                }

                const targetMissionName = newName ?? mission.name;
                const exists = await missionRepository.exists({
                    where: {
                        name: targetMissionName,
                        uuid: Not(missionUUID),
                        project: { uuid: targetProjectUUID },
                    },
                });
                if (exists) {
                    throw new ConflictException(
                        'Mission with that name already exists in the project',
                    );
                }

                rollbackTags = mission.files.map((file) => ({
                    fileUUID: file.uuid,
                    filename: file.filename,
                    missionUUID: missionUUID,
                    projectUUID: mission.project?.uuid ?? '',
                }));

                const updateResult = await missionRepository.update(
                    {
                        uuid: missionUUID,
                        project: { uuid: mission.project.uuid },
                    },
                    {
                        name: targetMissionName,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
                        project: { uuid: targetProjectUUID } as any,
                    },
                );
                if (updateResult.affected !== 1) {
                    throw new ConflictException(
                        'Mission changed during migration. Retry the migration request.',
                    );
                }

                for (const file of mission.files) {
                    await this.dataStorage.addTags(file.uuid, {
                        filename: file.filename,
                        missionUuid: missionUUID,
                        projectUuid: targetProjectUUID,
                    });
                }
            });
        } catch (error) {
            if (
                error instanceof QueryFailedError &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                error.driverError?.code === '23505'
            ) {
                throw new ConflictException(
                    'Mission with that name already exists in the target project',
                );
            }
            for (const file of rollbackTags) {
                try {
                    await this.dataStorage.addTags(file.fileUUID, {
                        filename: file.filename,
                        missionUuid: file.missionUUID,
                        projectUuid: file.projectUUID,
                    });
                } catch {
                    // Best-effort rollback; keep propagating the original migration error.
                }
            }
            throw error;
        }
    }

    async moveMission(missionUUID: string, projectUUID: string): Promise<void> {
        await this.migrateMission(missionUUID, projectUUID);
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
        await this.missionRepository.softRemove(mission);
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

    async download(
        missionUUID: string,
    ): Promise<{ filename: string; link: string }[]> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['files', 'project'],
        });

        if (mission.files === undefined) throw new Error('Files not loaded');

        return await Promise.all(
            mission.files.map(async (f) => ({
                filename: f.filename,
                link: await this.dataStorage.getPresignedDownloadUrl(
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

    async updateName(
        uuid: string,
        name: string,
    ): Promise<MissionEntity | null> {
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
