import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { convertGlobToLikePattern } from './utils';
import {
    Brackets,
    DataSource,
    FindOptionsSelect,
    FindOptionsWhere,
    ILike,
    In,
    Like,
    MoreThan,
    Repository,
} from 'typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { UpdateFile } from '@common/api/types/update-file.dto';
import env from '@common/environment';
import Mission from '@common/entities/mission/mission.entity';
import Project from '@common/entities/project/project.entity';
import {
    DataType,
    FileLocation,
    FileOrigin,
    FileState,
    FileType,
    QueueState,
    UserRole,
} from '@common/frontend_shared/enum';
import User from '@common/entities/user/user.entity';
import logger from '../logger';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tag-type.entity';
import axios from 'axios';
import QueueEntity from '@common/entities/queue/queue.entity';
import Queue from 'bull';
import { redis } from '@common/consts';
import {
    addTagsToMinioObject,
    deleteFileMinio,
    externalMinio,
    generateTemporaryCredential,
    getBucketFromFileType,
    getInfoFromMinio,
    internalMinio,
} from '@common/minio-helper';
import Category from '@common/entities/category/category.entity';
import { parseMinioMetrics } from '../endpoints/file/utils';
import Credentials from 'minio/dist/main/Credentials';
import { BucketItem } from 'minio';
import { TaggingOpts } from 'minio/dist/main/internal/type';
import { StorageOverviewDto } from '@common/api/types/storage-overview.dto';
import { FilesDto } from '@common/api/types/file/files.dto';
import { FileWithTopicDto } from '@common/api/types/file/file.dto';
import { addAccessConstraints } from '../endpoints/auth/auth-helper';
import {
    FileExistsResponseDto,
    TemporaryFileAccessDto,
    TemporaryFileAccessesDto,
} from '@common/api/types/file/access.dto';

// Type guard function to check if the error has a 'code' property
function isErrorWithCode(error: unknown): error is { code: string } {
    return typeof error === 'object' && error !== null && 'code' in error;
}

@Injectable()
export class FileService implements OnModuleInit {
    private fileCleanupQueue!: Queue.Queue;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Category)
        private categoryRepository: Repository<Category>,
    ) {}

    onModuleInit(): any {
        this.fileCleanupQueue = new Queue('file-cleanup', {
            redis,
        });
    }

    async findAll(
        userUUID: string,
        take: number,
        skip: number,
    ): Promise<FilesDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            const [files, count] = await this.fileRepository.findAndCount({
                relations: ['mission'],
                skip,
                take,
            });
            return {
                data: files.map((f) => f.fileDto),
                count,
                take,
                skip,
            };
        }
        const [files, count] = await addAccessConstraints(
            this.fileRepository
                .createQueryBuilder('file')
                .leftJoinAndSelect('file.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('file.creator', 'user')
                .orderBy('file.filename', 'ASC')
                .skip(skip)
                .take(take),
            userUUID,
        ).getManyAndCount();

        console.log(files);

        return {
            data: files.map((f) => f.fileDto),
            count,
            take,
            skip,
        };
    }

    async findMany(
        projectUuids: string[],
        projectPatterns: string[],
        missionUuids: string[],
        missionPatterns: string[],
        fileUuids: string[],
        filePatterns: string[],
        take: number,
        skip: number,
        userUuid: string,
    ): Promise<FilesDto> {
        // we dont support bracket expressions at the moment.
        const projectLikePatterns = projectPatterns.map((pattern) =>
            convertGlobToLikePattern(pattern),
        );
        const missionLikePatterns = missionPatterns.map((pattern) =>
            convertGlobToLikePattern(pattern),
        );
        const fileLikePatterns = filePatterns.map((pattern) =>
            convertGlobToLikePattern(pattern),
        );

        let query = this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.creator', 'user');

        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUuid },
        });

        if (user.role !== UserRole.ADMIN) {
            query = addAccessConstraints(query, userUuid);
        }

        // project query
        query.andWhere(
            new Brackets((qb) => {
                if (projectUuids.length > 0) {
                    qb.orWhere('project.uuid IN (:...projectUuids)', {
                        projectUuids,
                    });
                }
                if (projectLikePatterns.length > 0) {
                    qb.orWhere(
                        'project.name LIKE ANY(ARRAY[:...projectPatterns])',
                        {
                            projectPatterns: projectLikePatterns,
                        },
                    );
                }
            }),
        );

        // mission query
        query.andWhere(
            new Brackets((qb) => {
                if (missionUuids.length > 0) {
                    qb.orWhere('mission.uuid IN (:...missionUuids)', {
                        missionUuids,
                    });
                }
                if (missionLikePatterns.length > 0) {
                    qb.orWhere(
                        'mission.name LIKE ANY(ARRAY[:...missionPatterns])',
                        {
                            missionPatterns: missionLikePatterns,
                        },
                    );
                }
            }),
        );

        // file query
        query.andWhere(
            new Brackets((qb) => {
                if (fileUuids.length > 0) {
                    qb.orWhere('file.uuid IN (:...fileUuids)', { fileUuids });
                }
                if (fileLikePatterns.length > 0) {
                    qb.orWhere(
                        'file.filename LIKE ANY(ARRAY[:...filePatterns])',
                        {
                            filePatterns: fileLikePatterns,
                        },
                    );
                }
            }),
        );

        console.log(query.getSql());

        const [files, count] = await query
            .take(take)
            .skip(skip)
            .getManyAndCount();

        return {
            data: files.map((f) => f.fileDto),
            count,
            take,
            skip,
        };
    }

    async findFilteredByNames(
        projectName: string,
        missionName: string,
        topics: string,
        userUUID: string,
        take: number,
        skip: number,
        tags: Record<string, any>,
    ): Promise<FilesDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        let splitTopics: string[] = [];
        if (topics) {
            splitTopics = topics.split(',');
        }

        // Start building your query with basic filters
        let query = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .distinct(true)
            .leftJoin('file.mission', 'mission')
            .leftJoin('mission.project', 'project')
            .skip(skip)
            .take(take);

        if (user.role !== UserRole.ADMIN) {
            query = addAccessConstraints(query, userUUID);
        }
        if (projectName) {
            query.andWhere('project.name = :projectName', { projectName });
        }
        if (missionName) {
            query.andWhere('mission.name = :missionName', { missionName });
        }
        if (splitTopics && splitTopics.length > 0) {
            // Define a subquery that selects files associated with all required topics
            const topicSubquery = this.fileRepository
                .createQueryBuilder('subfile')
                .select('subfile.uuid')
                .leftJoin('subfile.topics', 'subtopic')
                .where('subtopic.name IN (:...topics)', {
                    topics: splitTopics,
                })
                .groupBy('subfile.uuid')
                .having('COUNT(subfile.uuid) = :topicCount', {
                    topicCount: splitTopics.length,
                });

            // Use the subquery in the main query
            query
                .andWhere(`file.uuid IN (${topicSubquery.getQuery()})`)
                .setParameters(topicSubquery.getParameters()); // Ensure all parameters are correctly set
        }
        if (tags) {
            query
                .leftJoin('mission.tags', 'tag')
                .leftJoin('tag.tagType', 'tagtype');
            for (const [key, value] of Object.entries(tags)) {
                query.andWhere('tagtype.name = :tagName', { tagName: key });
                query.andWhere(
                    new Brackets((qb) => {
                        if (typeof value === 'string') {
                            qb.where('tag.STRING = :value', { value }).orWhere(
                                'tag.LOCATION = :value',
                                { value },
                            );
                            if (new Date(value).toString() !== 'Invalid Date') {
                                qb.orWhere('tag.DATE = :value', { value });
                            }
                        }
                        if (typeof value === 'number') {
                            qb.where('tag.NUMBER = :value', { value });
                        }
                        if (typeof value === 'boolean') {
                            qb.where('tag.BOOLEAN = :value', { value });
                        }
                    }),
                );
            }
        } // Execute the query
        const fileIds = await query.getMany();
        if (fileIds.length === 0) {
            return {
                data: [],
                count: 0,
                take,
                skip,
            };
        }
        const fileIdsArray = fileIds.map((file) => file.uuid);
        const [files, count] = await this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')

            .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
            .orderBy('file.filename', 'ASC')
            .getManyAndCount();

        return {
            data: files.map((f) => f.fileDto),
            count,
            take,
            skip,
        };
    }

    async findFiltered(
        fileName: string,
        projectUUID: string,
        missionUUID: string,
        startDate: Date | undefined,
        endDate: Date | undefined,
        topics: string,
        andOr: boolean,
        fileTypes: string,
        tags: Record<string, any>,
        userUUID: string,
        take: number,
        skip: number,
        sort: string,
        sortOrder: 'ASC' | 'DESC',
    ): Promise<FilesDto> {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        // Start building your query with basic filters
        let query = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .leftJoin('file.mission', 'mission')
            .leftJoin('file.topics', 'topic')
            .leftJoin('mission.project', 'project')
            .offset(skip)
            .limit(take)
            .orderBy(sort, sortOrder);

        // ADMIN user have access to all files, all other users have access to files based on their access
        if (user.role !== UserRole.ADMIN) {
            query = addAccessConstraints(query, userUUID);
        }

        // Apply filters for fileName, projectUUID, and date
        if (fileName) {
            logger.debug(`Filtering files by filename: ${fileName}`);
            query.andWhere('file.filename LIKE :fileName', {
                fileName: `%${fileName}%`,
            });
        }

        if (fileTypes) {
            const splitFileTypes = fileTypes.split(',');
            if (splitFileTypes.length === 1) {
                query.andWhere('file.type = :type', {
                    type:
                        splitFileTypes[0] === 'MCAP'
                            ? FileType.MCAP
                            : FileType.BAG,
                });
            }
        }

        if (projectUUID) {
            logger.debug(`Filtering files by projectUUID: ${projectUUID}`);
            query.andWhere('project.uuid = :projectUUID', { projectUUID });
        }

        if (missionUUID) {
            logger.debug(`Filtering files by missionUUID: ${missionUUID}`);
            query.andWhere('mission.uuid = :missionUUID', { missionUUID });
        }

        if (startDate && endDate) {
            logger.debug(
                `Filtering files by date range: ${startDate.toString()} - ${endDate.toString()}`,
            );
            query.andWhere('file.date BETWEEN :startDate AND :endDate', {
                startDate: startDate,
                endDate: endDate,
            });
        }

        if (topics) {
            const splitTopics = topics.split(',');
            if (splitTopics && topics.length > 0 && splitTopics.length > 0) {
                query.andWhere('topic.name IN (:...splitTopics)', {
                    splitTopics,
                });
            }

            if (andOr) {
                query.having('COUNT(file.uuid) = :topicCount', {
                    topicCount: splitTopics.length,
                });
            }
        }
        if (tags) {
            query
                .leftJoin('mission.tags', 'tag')
                .leftJoin('tag.tagType', 'tagtype');
            await Promise.all(
                Object.keys(tags).map(async (key, index) => {
                    const tagtype = await this.tagTypeRepository.findOneOrFail({
                        where: { uuid: key },
                    });

                    const subqueryname = `tagsubquery${index.toString()}`;
                    query.innerJoin(
                        (qb) => {
                            let subquery = qb
                                .from(Tag, 'tag')
                                .leftJoin('tag.tagType', 'tagtype')
                                .select('mission.uuid')
                                .leftJoin('tag.mission', 'mission')
                                .andWhere(
                                    `tagtype.uuid = :tagtype${index.toString()}`,
                                    {
                                        [`tagtype${index.toString()}`]: key,
                                    },
                                );

                            switch (tagtype.datatype) {
                                case DataType.BOOLEAN: {
                                    subquery = subquery.andWhere(
                                        `tag.BOOLEAN = :value${index.toString()}`,
                                        {
                                            [`value${index.toString()}`]:
                                                tags[key],
                                        },
                                    );
                                    break;
                                }
                                case DataType.DATE: {
                                    subquery = subquery.andWhere(
                                        `tag.DATE = :value${index.toString()}`,
                                        {
                                            [`value${index.toString()}`]:
                                                tags[key],
                                        },
                                    );
                                    break;
                                }
                                case DataType.LOCATION: {
                                    subquery = subquery.andWhere(
                                        `tag.LOCATION = :value${index.toString()}`,
                                        {
                                            [`value${index.toString()}`]:
                                                tags[key],
                                        },
                                    );
                                    break;
                                }
                                case DataType.NUMBER: {
                                    subquery = subquery.andWhere(
                                        `tag.NUMBER = :value${index.toString()}`,
                                        {
                                            [`value${index.toString()}`]:
                                                tags[key],
                                        },
                                    );
                                    break;
                                }
                                case DataType.STRING:
                                case DataType.LINK: {
                                    subquery = subquery.andWhere(
                                        `tag.STRING = :value${index.toString()}`,
                                        {
                                            [`value${index.toString()}`]:
                                                tags[key],
                                        },
                                    );
                                    break;
                                }
                            }

                            return subquery;
                        },
                        subqueryname,
                        `mission.uuid = ${subqueryname}.mission_uuid`,
                    );

                    // query.andWhere('mission.uuid IN ' + subqueryname);
                }),
            );
        }
        query.groupBy('file.uuid');
        // Execute the query
        const [fileIds, count] = await query.getManyAndCount();
        if (fileIds.length === 0) {
            logger.silly('No files found');
            return {
                count,
                data: [],
                take,
                skip,
            };
        }

        const fileIdsArray = fileIds.map((file) => file.uuid);
        const files = await this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')
            .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
            .orderBy(sort, sortOrder)
            .getMany();
        return {
            count,
            data: files.map((file) => file.fileDto),
            take,
            skip,
        };
    }

    async findOne(uuid: string): Promise<FileWithTopicDto> {
        const { fileWithTopicDto } = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: [
                'mission',
                'topics',
                'mission.project',
                'creator',
                'categories',
            ],
        });

        return fileWithTopicDto;
    }

    /**
     * Updates a file with the given uuid.
     * @param uuid
     * @param file
     */
    async update(uuid: string, file: UpdateFile) {
        logger.debug(`Updating file with uuid: ${uuid}`);
        logger.debug(`New file data: ${JSON.stringify(file)}`);

        const databaseFile = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: { mission: { project: true } },
        });

        if (!databaseFile.mission) throw new Error('Mission not found!');
        if (!databaseFile.mission.project)
            throw new Error('Project not found!');

        // validate if file ending hasn't changed
        const fileEnding =
            databaseFile.type === FileType.MCAP ? '.mcap' : '.bag';
        if (!file.filename.endsWith(fileEnding)) {
            throw new BadRequestException('File ending must not be changed');
        }

        databaseFile.filename = file.filename;
        databaseFile.date = file.date;

        if (file.mission_uuid) {
            const newMission = await this.missionRepository.findOneOrFail({
                where: { uuid: file.mission_uuid },
                relations: ['project'],
            });

            if (!newMission.project) throw new Error('Project not found!');

            if (newMission) {
                databaseFile.mission = newMission;
            } else {
                throw new Error('Mission not found');
            }
        }

        if (file.categories) {
            const cats = await this.categoryRepository.find({
                where: { uuid: In(file.categories) },
            });
            databaseFile.categories = cats;
        }

        await this.dataSource
            .transaction(async (transactionalEntityManager) => {
                if (databaseFile.mission?.project === undefined) {
                    throw new Error('Mission or project not found!');
                }

                await transactionalEntityManager.save(
                    Project,
                    databaseFile.mission.project,
                );

                await transactionalEntityManager.save(
                    Mission,
                    databaseFile.mission,
                );
                await transactionalEntityManager.save(FileEntity, databaseFile);
            })
            .catch((error: unknown) => {
                if (isErrorWithCode(error) && error.code === '23505') {
                    throw new ConflictException(
                        'File with this name already exists in the mission',
                    );
                }
                throw error;
            });
        await addTagsToMinioObject(
            getBucketFromFileType(databaseFile.type),
            databaseFile.uuid,
            {
                // @ts-expect-error
                project_uuid: databaseFile.mission.project.uuid,
                mission_uuid: databaseFile.mission.uuid,
                filename: databaseFile.filename,
            },
        );
        return this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
    }

    /**
     * Generate a download link for a file with the given uuid.
     * The link will expire after 1 week if expires is set to true.
     *
     * @param uuid The unique identifier of the file
     * @param expires Whether the download link should expire
     */
    async generateDownload(uuid: string, expires: boolean) {
        // verify that an uuid is provided
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
        });

        // verify that the file exists in DB
        if (file.uuid === undefined || file.uuid !== uuid)
            throw new BadRequestException('File not found');

        const stats = await getInfoFromMinio(file.type, file.uuid);

        // verify that the file exists in Minio
        if (!stats) throw new NotFoundException('File not found');

        return await externalMinio.presignedUrl(
            'GET',
            file.type === FileType.MCAP
                ? env.MINIO_MCAP_BUCKET_NAME
                : env.MINIO_BAG_BUCKET_NAME,
            file.uuid, // we use the uuid as the filename in Minio
            expires ? 4 * 60 * 60 : 604_800, // 604800 seconds = 1 week
            {
                // set filename in response headers

                'response-content-disposition': `attachment; filename ="${file.filename}"`,
            },
        );
    }

    async findByMission(
        missionUUID: string,
        take: number,
        skip: number,
        filename?: string,
        fileType?: FileType,
        categories?: string[],
        sort?: string,
        sortDirection?: 'ASC' | 'DESC',
        health?: string,
    ): Promise<FilesDto> {
        const where: FindOptionsWhere<FileEntity> = {
            mission: { uuid: missionUUID },
        };
        if (filename) {
            where.filename = ILike(`%${filename}%`);
        }
        if (fileType !== undefined && fileType !== FileType.ALL) {
            where.type = fileType;
        }
        if (categories && categories.length > 0) {
            where.categories = { uuid: In(categories) };
        }
        switch (health) {
            case 'Healthy': {
                where.state = In([FileState.OK, FileState.FOUND]);
                break;
            }
            case 'Unhealthy': {
                where.state = In([
                    FileState.ERROR,
                    FileState.CONVERSION_ERROR,
                    FileState.LOST,
                    FileState.CORRUPTED,
                ]);
                break;
            }
            case 'Uploading': {
                where.state = FileState.UPLOADING;
            }
        }
        const select = [
            'uuid',
            sort?.toString() ?? 'name',
        ] as FindOptionsSelect<FileEntity>;

        const [filesUuids, count] = await this.fileRepository.findAndCount({
            select,
            where,
            take,
            skip,
            order: { [sort ?? 'name']: sortDirection },
        });
        if (filesUuids.length === 0) {
            return {
                count,
                data: [],
                take,
                skip,
            };
        }
        const secondWhere = {
            uuid: In(filesUuids.map((file) => file.uuid)),
        };

        const files = await this.fileRepository.find({
            where: secondWhere,
            relations: [
                'mission',
                'mission.project',
                'categories',
                'mission.creator',
                'creator',
            ],
            order: { [sort ?? 'name']: sortDirection },
        });
        return {
            count,
            data: files.map((file) => file.fileDto),
            take,
            skip,
        };
    }

    async findOneByName(missionUUID: string, name: string) {
        return this.fileRepository.findOne({
            where: { mission: { uuid: missionUUID }, filename: name },
            relations: ['creator'],
        });
    }

    async moveFiles(fileUUIDs: string[], missionUUID: string) {
        await Promise.all(
            fileUUIDs.map(async (uuid) => {
                try {
                    const file = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                    });
                    file.mission = { uuid: missionUUID } as Mission;
                    await this.fileRepository.save(file);
                    const newFile = await this.fileRepository.findOneOrFail({
                        where: { uuid },
                        relations: ['mission', 'mission.project'],
                    });
                    const bucket = getBucketFromFileType(file.type);
                    await addTagsToMinioObject(bucket, file.uuid, {
                        filename: file.filename,
                        mission_uuid: missionUUID,
                        // @ts-expect-error
                        project_uuid: newFile.mission.project.uuid,
                    });
                } catch (error) {
                    logger.error(
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        `Error moving file ${uuid} to mission ${missionUUID}: ${error}`,
                    );
                }
            }),
        );
    }

    /**
     * Delete a file with the given uuid.
     * The file will be removed from the database and from Minio.
     *
     * @param uuid The unique identifier of the file
     */
    async deleteFile(uuid: string): Promise<void> {
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        logger.debug(`Deleting file with uuid: ${uuid}`);

        // we delete the file from the database and Minio
        // using a transaction to ensure consistency
        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // find the file in the database
                const file = await transactionalEntityManager.findOneOrFail(
                    FileEntity,
                    { where: { uuid } },
                );

                // delete the file from Minio
                const bucket = getBucketFromFileType(file.type);
                await deleteFileMinio(bucket, file.uuid).catch(() => {
                    logger.error(
                        `File ${file.uuid} not found in Minio, deleting from database only!`,
                    );
                });

                await transactionalEntityManager.remove(file);
            },
        );

        logger.debug(`File with uuid ${uuid} deleted`);
    }

    async getStorage(): Promise<StorageOverviewDto> {
        const expiredAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

        const payload = {
            exp: expiredAt,
            sub: env.MINIO_ACCESS_KEY,
            iss: 'prometheus',
        };

        const token = jwt.sign(payload, env.MINIO_SECRET_KEY, {
            algorithm: 'HS512',
        });

        const headers = {
            Authorization: `Bearer ${token}`,
        };

        return axios
            .get('http://minio:9000/minio/metrics/v3/system/drive', {
                headers,
            })
            .then((response) => {
                const metrics: any = parseMinioMetrics(response.data);
                return {
                    usedBytes: metrics.minio_system_drive_used_bytes[0].value,
                    totalBytes: metrics.minio_system_drive_total_bytes[0].value,
                    usedInodes: metrics.minio_system_drive_used_inodes[0].value,
                    totalInodes:
                        metrics.minio_system_drive_total_inodes[0].value,
                } as StorageOverviewDto;
            });
    }

    async isUploading(userUUID: string) {
        return this.fileRepository
            .findOne({
                where: {
                    state: FileState.UPLOADING,
                    // pending uploads get canceled after 12 hours
                    // however this cleanup is done asynchronously once a day
                    createdAt: MoreThan(
                        new Date(Date.now() - 12 * 60 * 60 * 1000),
                    ),
                    creator: { uuid: userUUID },
                },
            })
            .then((r) => !!r);
    }

    /**
     * Get temporary access to upload files to Minio.
     * This function creates a new file entry in the database and a new queue entry.
     * The queue entry is used to track the upload progress.
     *
     * The function returns a list of access credentials for each file.
     *
     * @param filenames list of filenames to upload
     * @param missionUUID the mission to upload the files to
     * @param userUUID the user that is uploading the files
     */
    async getTemporaryAccess(
        filenames: string[],
        missionUUID: string,
        userUUID: string,
    ): Promise<TemporaryFileAccessesDto> {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        const credentials = await Promise.all(
            filenames.map(async (filename) => {
                const emptyCredentials: {
                    bucket: string | null;
                    fileName: string;
                    fileUUID: string | null;
                    accessCredentials: Credentials | null;
                    error: string | null;
                    queueUUID?: string;
                } = {
                    // eslint-disable-next-line unicorn/no-null
                    bucket: null,
                    fileName: filename,
                    // eslint-disable-next-line unicorn/no-null
                    fileUUID: null,
                    // eslint-disable-next-line unicorn/no-null
                    accessCredentials: null,
                    // eslint-disable-next-line unicorn/no-null
                    error: null,
                };

                logger.debug(`Creating temporary access for file: ${filename}`);

                // verify that file has ending .bag or .mcap
                if (!filename.endsWith('.bag') && !filename.endsWith('.mcap')) {
                    emptyCredentials.error = 'Invalid file ending';
                    return emptyCredentials;
                }

                const fileType: FileType = filename.endsWith('.bag')
                    ? FileType.BAG
                    : FileType.MCAP;

                // check if file already exists
                const existingFile = await this.fileRepository.exists({
                    where: {
                        filename,
                        mission: {
                            uuid: missionUUID,
                        },
                    },
                });
                if (existingFile) {
                    emptyCredentials.error = 'File already exists';
                    emptyCredentials.fileName = filename;
                    return emptyCredentials;
                }

                const file = await this.fileRepository.save(
                    this.fileRepository.create({
                        date: new Date(),
                        size: 0,
                        filename,
                        mission,

                        creator: user,
                        type: fileType,
                        state: FileState.UPLOADING,
                        origin: FileOrigin.UPLOAD,
                    }),
                );

                const queueEntity = await this.queueRepository.save(
                    this.queueRepository.create({
                        identifier: file.uuid,

                        display_name: filename,
                        state: QueueState.AWAITING_UPLOAD,
                        location: FileLocation.MINIO,
                        mission,
                        creator: user,
                    }),
                );

                return {
                    bucket: getBucketFromFileType(fileType),
                    fileUUID: file.uuid,
                    fileName: filename,
                    accessCredentials: await generateTemporaryCredential(
                        file.uuid,
                        getBucketFromFileType(fileType),
                    ),
                    queueUUID: queueEntity.uuid,
                };
            }),
        );

        return {
            // TODO: fix typing
            data: credentials as unknown as TemporaryFileAccessDto[],
            count: credentials.length,
            skip: 0,
            take: credentials.length,
        };
    }

    async cancelUpload(uuids: string[], missionUUID: string, userUUID: string) {
        // Cleanup cannot be done synchronously as this takes too long; the request is sent on unload; delaying the onUnload is difficult and discouraged
        return this.fileCleanupQueue.add('cancelUpload', {
            uuids,
            missionUUID,
            userUUID,
        });
    }

    /**
     * Delete multiple files with the given uuids.
     *
     * This function will remove the files from the database and from Minio.
     * The deletion fails if any of the files is not found in the database or
     * if any of the files is not found in Minio. It verifies the files in the
     * database and Minio in a single transaction to ensure consistency.
     *
     * @param fileUUIDs The unique identifiers of the files
     * @param missionUUID The unique identifier of the mission
     *
     */
    async deleteMultiple(
        fileUUIDs: string[],
        missionUUID: string,
    ): Promise<void> {
        const uniqueFilesUuids = [...new Set(fileUUIDs)];

        await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // get a list of all files to delete
                const files = await transactionalEntityManager.find(
                    FileEntity,
                    // eslint-disable-next-line unicorn/no-array-method-this-argument
                    {
                        where: {
                            uuid: In(uniqueFilesUuids),
                            mission: { uuid: missionUUID },
                        },
                    },
                );

                // verify that all files are found in the database
                const uniqueDatabaseFilesUuids = [
                    ...new Set(files.map((f) => f.uuid)),
                ];
                if (
                    uniqueDatabaseFilesUuids.length !== uniqueFilesUuids.length
                ) {
                    throw new NotFoundException(
                        'Some files not found, aborting',
                    );
                }

                await Promise.all(
                    files.map(async (file) => {
                        const bucket = getBucketFromFileType(file.type);
                        await deleteFileMinio(bucket, file.uuid).catch(() => {
                            logger.error(
                                `File ${file.uuid} not found in Minio, deleting from database only!`,
                            );
                        });
                    }),
                );

                await transactionalEntityManager.remove(files);
            },
        );
    }

    /**
     * Check if a file with the given uuid exists.
     * @param fileUUID
     */
    async exists(fileUUID: string): Promise<FileExistsResponseDto> {
        return {
            exists: await this.fileRepository.exists({
                where: { uuid: fileUUID },
            }),
            uuid: fileUUID,
        };
    }

    async renameTags(bucked: string) {
        const files = internalMinio.listObjects(bucked, '');
        const filesList = await files.toArray();
        await Promise.all(
            filesList.map(async (file: BucketItem) => {
                if (!file.name) {
                    logger.debug(`Filename is empty: ${JSON.stringify(file)}`);
                    return;
                }
                const fileEntity = await this.fileRepository.findOne({
                    where: { uuid: file.name },
                    relations: ['mission', 'mission.project'],
                });
                if (fileEntity === null) {
                    logger.error(`File ${file.name} not found in database`);
                    return;
                }
                await internalMinio.removeObjectTagging(
                    bucked,
                    file.name,
                    {} as TaggingOpts,
                );

                if (fileEntity.mission === undefined)
                    throw new Error('Mission not found!');
                if (fileEntity.mission.project === undefined)
                    throw new Error('Project not found!');

                await addTagsToMinioObject(bucked, file.name, {
                    project_uuid: fileEntity.mission.project.uuid,

                    mission_uuid: fileEntity.mission.uuid,
                    filename: fileEntity.filename,
                });
            }),
        ).catch((error: unknown) => {
            logger.error(error);
        });
    }

    async recomputeFileSizes() {
        const files = await this.fileRepository.find({
            where: {
                state: In([FileState.OK, FileState.FOUND]),
            },
        });
        await Promise.all(
            files.map(async (file) => {
                const stats = await getInfoFromMinio(file.type, file.uuid);
                if (stats) {
                    file.size = stats.size;
                    logger.debug(
                        `Updated size for ${file.filename}: ${file.size.toString()}`,
                    );
                } else {
                    logger.error(
                        `File ${file.uuid} not found in Minio, setting state to LOST`,
                    );
                    file.state = FileState.LOST;
                }
                await this.fileRepository.save(file);
            }),
        );
    }
}
