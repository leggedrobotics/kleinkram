import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, ILike, Repository } from 'typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { UpdateFile } from './entities/update-file.dto';
import env from '@common/env';
import Mission from '@common/entities/mission/mission.entity';
import { externalMinio, moveFile } from '../minioHelper';
import Project from '@common/entities/project/project.entity';
import Topic from '@common/entities/topic/topic.entity';
import { DataType, FileType, UserRole } from '@common/enum';
import User from '@common/entities/user/user.entity';
import { addAccessJoinsAndConditions } from '../auth/authHelper';
import logger from '../logger';
import Tag from '@common/entities/tag/tag.entity';
import TagType from '@common/entities/tagType/tagType.entity';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(Topic) private topicRepository: Repository<Topic>,
        @InjectRepository(User) private userRepository: Repository<User>,
        private readonly dataSource: DataSource,
        @InjectRepository(TagType)
        private tagTypeRepository: Repository<TagType>,
    ) {}

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
        return addAccessJoinsAndConditions(
            this.fileRepository
                .createQueryBuilder('file')
                .leftJoinAndSelect('file.mission', 'mission')
                .leftJoin('mission.project', 'project')
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
            query = addAccessJoinsAndConditions(query, userUUID);
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
        mcapBag: boolean,
        tags: Record<string, any>,
        userUUID: string,
        take: number,
        skip: number,
    ) {
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
            .andWhere('file.type = :type', {
                type: mcapBag ? FileType.MCAP : FileType.BAG,
            })
            .skip(skip)
            .take(take);

        // ADMIN user have access to all files, all other users have access to files based on their access
        if (user.role !== UserRole.ADMIN) {
            query = addAccessJoinsAndConditions(query, userUUID);
        }

        // Apply filters for fileName, projectUUID, and date
        if (fileName) {
            logger.debug('Filtering files by filename: ' + fileName);
            query.andWhere('file.filename LIKE :fileName', {
                fileName: `%${fileName}%`,
            });
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
                            console.log(
                                'Subquery: \n',
                                subquery.getQueryAndParameters(),
                            );
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
            .getMany();
        return [res, count];
    }

    async findOne(uuid: string) {
        return this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'topics', 'mission.project', 'creator'],
        });
    }

    async findByFilename(filename: string) {
        return this.fileRepository.findOne({
            where: { filename },
            relations: ['mission', 'topics', 'mission.project'],
        });
    }

    async update(uuid: string, file: UpdateFile) {
        logger.debug('Updating file with uuid: ' + uuid);
        logger.debug('New file data: ' + JSON.stringify(file));

        const db_file = await this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });

        if (!db_file) {
            throw new Error('File not found');
        }

        // validate if file ending hasn't changed
        if (db_file.type === FileType.MCAP && file.filename.endsWith('.bag')) {
            throw new BadRequestException('File ending cannot be changed.');
        } else if (
            db_file.type === FileType.BAG &&
            file.filename.endsWith('.mcap')
        ) {
            throw new BadRequestException('File ending cannot be changed.');
        }

        const srcPath = `${db_file.mission.project.name}/${db_file.mission.name}/${db_file.filename}`;
        const bucketName =
            db_file.type === FileType.MCAP
                ? env.MINIO_MCAP_BUCKET_NAME
                : env.MINIO_BAG_BUCKET_NAME;

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

        if (file.project_uuid) {
            const newProject = await this.projectRepository.findOne({
                where: { uuid: file.project_uuid },
            });
            if (newProject) {
                db_file.mission.project = newProject;
            } else {
                throw new Error('Project not found');
            }
        }

        const destPath = `${db_file.mission.project.name}/${db_file.mission.name}/${db_file.filename}`;
        if (srcPath !== destPath) {
            await moveFile(srcPath, destPath, bucketName);
        }
        await this.dataSource.transaction(
            async (transactionalEntityManager) => {
                await transactionalEntityManager.save(
                    Project,
                    db_file.mission.project,
                );
                await transactionalEntityManager.save(Mission, db_file.mission);
                await transactionalEntityManager.save(FileEntity, db_file);
            },
        );

        return this.fileRepository.findOne({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
    }

    async generateDownload(uuid: string, expires: boolean) {
        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
        if (file.uuid === undefined || file.uuid !== uuid) {
            throw new Error('File not found');
        }
        return await externalMinio.presignedUrl(
            'GET',
            file.type === FileType.MCAP
                ? env.MINIO_MCAP_BUCKET_NAME
                : env.MINIO_BAG_BUCKET_NAME,
            `${file.mission.project.name}/${file.mission.name}/${file.filename}`,
            expires ? 4 * 60 * 60 : 604800, // 604800 seconds = 1 week
        );
    }

    async generateDownloadForToken(missionUUID: string) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['files', 'project'],
        });
        const urls = await Promise.all(
            mission.files.map((f) =>
                externalMinio.presignedUrl(
                    'GET',
                    env.MINIO_BAG_BUCKET_NAME,
                    `${mission.project.name}/${mission.name}/${f.filename}`,
                    4 * 60 * 60,
                ),
            ),
        );
        return urls;
    }

    async clear() {
        await this.topicRepository.query('DELETE FROM "topic"');
        await this.fileRepository.query('DELETE FROM "file"');
    }

    async findByMission(
        missionUUID: string,
        take: number,
        skip: number,
        filename?: string,
        fileType?: FileType,
    ): Promise<[FileEntity[], number]> {
        const where: Record<string, any> = { mission: { uuid: missionUUID } };
        if (filename) {
            where.filename = ILike(`%${filename}%`);
        }
        if (fileType) {
            where.type = fileType;
        }
        return this.fileRepository.findAndCount({
            where,
            relations: ['mission', 'topics', 'creator', 'mission.creator'],
            take,
            skip,
        });
    }

    async findOneByName(missionUUID: string, name: string) {
        return this.fileRepository.findOne({
            where: { mission: { uuid: missionUUID }, filename: name },
            relations: ['creator'],
        });
    }
}
