import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import File from './entities/file.entity';
import { UpdateFile } from './entities/update-file.dto';
import env from '../env';
import Mission from '../mission/entities/mission.entity';
import { externalMinio } from '../minioHelper';
import Project from '../project/entities/project.entity';
import Topic from '../topic/entities/topic.entity';

@Injectable()
export class FileService {
    constructor(
        @InjectRepository(File) private fileRepository: Repository<File>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(Project)
        private projectRepository: Repository<Project>,
        @InjectRepository(Topic) private topicRepository: Repository<Topic>,
    ) {}

    async findAll() {
        return this.fileRepository.find({ relations: ['mission'] });
    }

    async findFilteredByNames(
        projectName: string,
        missionName: string,
        topics: string[],
    ) {
        // Start building your query with basic filters
        const query = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .leftJoin('file.mission', 'mission')
            .leftJoin('file.topics', 'topic')
            .leftJoin('mission.project', 'project');
        if (projectName) {
            query.andWhere('project.name = :projectName', { projectName });
        }
        if (missionName) {
            query.andWhere('mission.name = :missionName', { missionName });
        }
        if (topics && topics.length > 0) {
            query.andWhere('topic.name IN (:...topics)', { topics });

            query
                .groupBy('file.uuid')
                .having('COUNT(file.uuid) = :topicCount', {
                    topicCount: topics.length,
                });
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
        startDate: string,
        endDate: string,
        topics: string,
        and_or: boolean,
    ) {
        // Start building your query with basic filters
        const query = this.fileRepository
            .createQueryBuilder('file')
            .select('file.uuid')
            .leftJoin('file.mission', 'mission')
            .leftJoin('file.topics', 'topic')
            .leftJoin('mission.project', 'project');
        // Apply filters for fileName, projectUUID, and date
        if (fileName) {
            query.andWhere('file.filename LIKE :fileName', {
                fileName: `%${fileName}%`,
            });
        }
        if (projectUUID) {
            query.andWhere('project.uuid = :projectUUID', { projectUUID });
        }
        if (missionUUID) {
            query.andWhere('mission.uuid = :missionUUID', { missionUUID });
        }
        if (startDate && endDate) {
            query.andWhere('file.date BETWEEN :startDate AND :endDate', {
                startDate: new Date(startDate),
                endDate: new Date(endDate),
            });
        }
        const splitTopics = topics.split(',');
        if (splitTopics && topics.length > 0 && splitTopics.length > 0) {
            query.andWhere('topic.name IN (:...splitTopics)', { splitTopics });
        }
        query.groupBy('file.uuid');

        if (and_or) {
            query.having('COUNT(file.uuid) = :topicCount', {
                topicCount: splitTopics.length,
            });
        }
        // Execute the query
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
        const db_file = await this.fileRepository.findOne({ where: { uuid } });
        db_file.filename = file.filename;
        db_file.date = file.date;
        if (file.mission) {
            db_file.mission = await this.missionRepository.findOne({
                where: { uuid: file.mission.uuid },
            });
        }
        if (file.project) {
            db_file.mission.project = await this.projectRepository.findOne({
                where: { uuid: file.project.uuid },
            });
        }
        await this.fileRepository.save(db_file);
        return this.fileRepository.findOne({ where: { uuid } });
    }

    async generateDownload(uuid: string, expires: boolean) {
        const file = await this.fileRepository.findOneOrFail({
            where: { uuid },
            relations: ['mission', 'mission.project'],
        });
        return await externalMinio.presignedUrl(
            'GET',
            env.MINIO_BAG_BUCKET_NAME,
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

    async findByMission(missionUUID: string) {
        return this.fileRepository.find({
            where: { mission: { uuid: missionUUID } },
            relations: ['mission', 'topics', 'creator', 'mission.creator'],
        });
    }
}
