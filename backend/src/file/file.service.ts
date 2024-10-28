import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    OnModuleInit,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, ILike, In, MoreThan, Repository } from 'typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { UpdateFile } from './entities/update-file.dto';
import env from '@common/env';
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
} from '@common/enum';
import User from '@common/entities/user/user.entity';
import { addAccessConstraints } from '../auth/authHelper';
import logger from '../logger';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';
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
} from '@common/minio_helper';
import Category from '@common/entities/category/category.entity';
import { parseMinioMetrics } from './utils';
import Credentials from 'minio/dist/main/Credentials';
import { BucketItem } from 'minio';
import { TaggingOpts } from 'minio/dist/main/internal/type';

@Injectable()
export class FileService implements OnModuleInit {
    private fileCleanupQueue: Queue.Queue;

    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
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
        this.fileCleanupQueue = new Queue('action-queue', {
            redis,
        });
    }

    async findAll(userUUID: string, take: number, skip: number) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (user.role === UserRole.ADMIN) {
            return this.fileRepository.find({
                relations: ['mission'],
                skip,
                take,
            });
        }
        return addAccessConstraints(
            this.fileRepository
                .createQueryBuilder('file')
                .leftJoinAndSelect('file.mission', 'mission')
                .leftJoin('mission.project', 'project')
                .orderBy('file.filename', 'ASC')
                .skip(skip)
                .take(take),
            userUUID,
        ).getMany();
    }

    async findFilteredByNames(
        projectName: string,
        missionName: string,
        topics: string,
        userUUID: string,
        take: number,
        skip: number,
        tags: Record<string, any>,
    ) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        let splitTopics = [];
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
                .andWhere('file.uuid IN (' + topicSubquery.getQuery() + ')')
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
            return [];
        }
        const fileIdsArray = fileIds.map((file) => file.uuid);
        return await this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')

            .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
            .orderBy('file.filename', 'ASC')
            .getMany();
    }

    async findFiltered(
        fileName: string,
        projectUUID: string,
        missionUUID: string,
        startDate: Date,
        endDate: Date,
        topics: string,
        and_or: boolean,
        fileTypes: string,
        tags: Record<string, any>,
        userUUID: string,
        take: number,
        skip: number,
        sort: string,
        desc: boolean,
    ) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        // const sortColumn = `file.${sort || 'date'}`;
        const sortOrder = desc ? 'DESC' : 'ASC';
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
            logger.debug('Filtering files by filename: ' + fileName);
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
            logger.debug('Filtering files by projectUUID: ' + projectUUID);
            query.andWhere('project.uuid = :projectUUID', { projectUUID });
        }

        if (missionUUID) {
            logger.debug('Filtering files by missionUUID: ' + missionUUID);
            query.andWhere('mission.uuid = :missionUUID', { missionUUID });
        }

        if (startDate && endDate) {
            logger.debug(
                'Filtering files by date range: ' + startDate + ' - ' + endDate,
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

            if (and_or) {
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
                Object.keys(tags).map(async (key, idx) => {
                    const tagtype = await this.tagTypeRepository.findOneOrFail({
                        where: { uuid: key },
                    });

                    const subqueryname = 'tagsubquery' + idx;
                    query.innerJoin(
                        (qb) => {
                            let subquery = qb
                                .from(Tag, 'tag')
                                .leftJoin('tag.tagType', 'tagtype')
                                .select('mission.uuid')
                                .leftJoin('tag.mission', 'mission')
                                .andWhere('tagtype.uuid = :tagtype' + idx, {
                                    ['tagtype' + idx]: key,
                                });

                            switch (tagtype.datatype) {
                                case DataType.BOOLEAN:
                                    subquery = subquery.andWhere(
                                        'tag.BOOLEAN = :value' + idx,
                                        {
                                            ['value' + idx]: tags[key],
                                        },
                                    );
                                    break;
                                case DataType.DATE:
                                    subquery = subquery.andWhere(
                                        'tag.DATE = :value' + idx,
                                        {
                                            ['value' + idx]: tags[key],
                                        },
                                    );
                                    break;
                                case DataType.LOCATION:
                                    subquery = subquery.andWhere(
                                        'tag.LOCATION = :value' + idx,
                                        {
                                            ['value' + idx]: tags[key],
                                        },
                                    );
                                    break;
                                case DataType.NUMBER:
                                    subquery = subquery.andWhere(
                                        'tag.NUMBER = :value' + idx,
                                        {
                                            ['value' + idx]: tags[key],
                                        },
                                    );
                                    break;
                                case DataType.STRING:
                                case DataType.LINK:
                                    subquery = subquery.andWhere(
                                        'tag.STRING = :value' + idx,
                                        {
                                            ['value' + idx]: tags[key],
                                        },
                                    );
                                    break;
                            }

                            return subquery;
                        },
                        subqueryname,
                        'mission.uuid = ' + subqueryname + '.mission_uuid',
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
            return [];
        }

        const fileIdsArray = fileIds.map((file) => file.uuid);
        const res = await this.fileRepository
            .createQueryBuilder('file')
            .leftJoinAndSelect('file.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('file.topics', 'topic')
            .leftJoinAndSelect('file.creator', 'creator')
            .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
            .orderBy(sort, sortOrder)
            .getMany();
        return [res, count];
    }

    async findOne(uuid: string) {
        return this.fileRepository.findOne({
            where: { uuid },
            relations: [
                'mission',
                'topics',
                'mission.project',
                'creator',
                'categories',
            ],
        });
    }

    async findByFilename(filename: string) {
        return this.fileRepository.findOne({
            where: { filename },
            relations: ['mission', 'topics', 'mission.project'],
        });
    }

    /**
     * Updates a file with the given uuid.
     * @param uuid
     * @param file
     */
    async update(uuid: string, file: UpdateFile) {
        logger.debug('Updating file with uuid: ' + uuid);
        logger.debug('New file data: ' + JSON.stringify(file));

        const db_file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });

        // validate if file ending hasn't changed
        const fileEnding = db_file.type === FileType.MCAP ? '.mcap' : '.bag';
        if (!file.filename.endsWith(fileEnding)) {
            throw new BadRequestException('File ending must not be changed');
        }

        db_file.filename = file.filename;
        db_file.date = file.date;

        if (file.mission_uuid) {
            const newMission = await this.missionRepository.findOne({
                where: { uuid: file.mission_uuid },
                relations: ['project'],
            });
            if (newMission) {
                db_file.mission = newMission;
            } else {
                throw new Error('Mission not found');
            }
        }

        if (file.categories) {
            const cats = await this.categoryRepository.find({
                where: { uuid: In(file.categories) },
            });
            db_file.categories = cats;
        }

        await this.dataSource
            .transaction(async (transactionalEntityManager) => {
                await transactionalEntityManager.save(
                    Project,
                    db_file.mission.project,
                );
                await transactionalEntityManager.save(Mission, db_file.mission);
                await transactionalEntityManager.save(FileEntity, db_file);
            })
            .catch((err) => {
                if (err.code === '23505') {
                    throw new ConflictException(
                        'File with this name already exists in the mission',
                    );
                }
                throw err;
            });
        await addTagsToMinioObject(
            getBucketFromFileType(db_file.type),
            db_file.uuid,
            {
                project_uuid: db_file.mission.project.uuid,
                mission_uuid: db_file.mission.uuid,
                filename: db_file.filename,
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
            expires ? 4 * 60 * 60 : 604800, // 604800 seconds = 1 week
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
    ): Promise<[FileEntity[], number]> {
        const where: Record<string, any> = {
            mission: { uuid: missionUUID },
        };
        if (filename) {
            where.filename = ILike(`%${filename}%`);
        }
        if (fileType) {
            where.type = fileType;
        }
        if (categories && categories.length > 0) {
            where.categories = { uuid: In(categories) };
        }
        const [resUUIDs, count] = await this.fileRepository.findAndCount({
            select: ['uuid', 'filename'],
            where,
            take,
            skip,
            order: { filename: 'ASC' },
        });
        if (resUUIDs.length === 0) {
            return [[], count];
        }
        const second_where = {
            uuid: In(resUUIDs.map((file) => file.uuid)),
        };

        const files = await this.fileRepository.find({
            where: second_where,
            relations: [
                'mission',
                'mission.project',
                'categories',
                'mission.creator',
                'creator',
            ],
            order: { filename: 'ASC' },
        });
        return [files, count];
    }

    async findOneByName(missionUUID: string, name: string) {
        return this.fileRepository.findOne({
            where: { mission: { uuid: missionUUID }, filename: name },
            relations: ['creator'],
        });
    }

    /**
     * Delete a file with the given uuid.
     * The file will be removed from the database and from Minio.
     *
     * @param uuid The unique identifier of the file
     */
    async deleteFile(uuid: string) {
        if (!uuid || uuid === '')
            throw new BadRequestException('UUID is required');

        logger.debug('Deleting file with uuid: ' + uuid);

        // we delete the file from the database and Minio
        // using a transaction to ensure consistency
        return this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // find the file in the database
                const file = await transactionalEntityManager.findOneOrFail(
                    FileEntity,
                    { where: { uuid } },
                );

                // delete the file from Minio
                const bucket = getBucketFromFileType(file.type);
                await deleteFileMinio(bucket, file.uuid).catch((error) => {
                    logger.error(
                        `File ${file.uuid} not found in Minio, deleting from database only!`,
                    );
                });

                await transactionalEntityManager.remove(file);
            },
        );
    }

    async getStorage() {
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
                const metrics = parseMinioMetrics(response.data);
                return {
                    usedBytes:
                        metrics['minio_system_drive_used_bytes'][0].value,
                    totalBytes:
                        metrics['minio_system_drive_total_bytes'][0].value,
                    usedInodes:
                        metrics['minio_system_drive_used_inodes'][0].value,
                    totalInodes:
                        metrics['minio_system_drive_total_inodes'][0].value,
                };
            })
            .catch((error) => {
                console.error('Error:', error);
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
            .then((res) => !!res);
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
    ): Promise<
        {
            bucket: string;
            fileUUID: string;
            accessCredentials: Credentials;
        }[]
    > {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });

        return await Promise.all(
            filenames.map(async (filename) => {
                const emptyCredentials = {
                    bucket: null,
                    fileName: filename,
                    fileUUID: null,
                    accessCredentials: null,
                    error: null,
                };

                logger.debug('Creating temporary access for file: ' + filename);

                // verify that file has ending .bag or .mcap
                if (!filename.endsWith('.bag') && !filename.endsWith('.mcap')) {
                    emptyCredentials.error = 'Invalid file ending';
                    return emptyCredentials;
                }

                const fileType: FileType = filename.endsWith('.bag')
                    ? FileType.BAG
                    : FileType.MCAP;

                // check if file already exists
                const existingFile = await this.fileRepository.count({
                    where: {
                        filename,
                        mission: {
                            uuid: missionUUID,
                        },
                    },
                });
                if (existingFile > 0) {
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
    async deleteMultiple(fileUUIDs: string[], missionUUID: string) {
        const unique_files_uuids = [...new Set(fileUUIDs)];

        return await this.fileRepository.manager.transaction(
            async (transactionalEntityManager) => {
                // get a list of all files to delete
                const files = await transactionalEntityManager.find(
                    FileEntity,
                    {
                        where: {
                            uuid: In(unique_files_uuids),
                            mission: { uuid: missionUUID },
                        },
                    },
                );

                // verify that all files are found in the database
                const unique_db_files_uuids = [
                    ...new Set(files.map((f) => f.uuid)),
                ];
                if (
                    unique_db_files_uuids.length !== unique_files_uuids.length
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
    async exists(fileUUID: string) {
        return this.fileRepository.exists({ where: { uuid: fileUUID } });
    }

    async renameTags(bucked: string) {
        const files = internalMinio.listObjects(bucked, '');
        const filesList = await files.toArray();
        await Promise.all(
            filesList.map(async (file: BucketItem) => {
                const fileEntity = await this.fileRepository.findOne({
                    where: { uuid: file.name },
                    relations: ['mission', 'mission.project'],
                });
                if (!fileEntity) {
                    logger.error(`File ${file.name} not found in database`);
                    return;
                }
                await internalMinio.removeObjectTagging(
                    bucked,
                    file.name,
                    {} as TaggingOpts,
                );
                await addTagsToMinioObject(bucked, file.name, {
                    project_uuid: fileEntity.mission.project.uuid,
                    mission_uuid: fileEntity.mission.uuid,
                    filename: fileEntity.filename,
                });
            }),
        );
    }
}
