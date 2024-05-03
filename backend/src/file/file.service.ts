import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import File from './entities/file.entity';
import { UpdateFile } from './entities/update-file.dto';
import { TopicService } from '../topic/topic.service';
import env from '../env';
import Run from '../run/entities/run.entity';
import { minio } from '../minioHelper';
import Project from '../project/entities/project.entity';

@Injectable()
export class FileService {
  constructor(
    @InjectRepository(File) private fileRepository: Repository<File>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    private topicService: TopicService,
  ) {}

  async findAll() {
    return this.fileRepository.find({ relations: ['run'] });
  }

  async findFilteredByNames(
    projectName: string,
    runName: string,
    topics: string[],
  ) {
    // Start building your query with basic filters
    const query = this.fileRepository
      .createQueryBuilder('file')
      .select('file.uuid')
      .leftJoin('file.run', 'run')
      .leftJoin('file.topics', 'topic')
      .leftJoin('run.project', 'project');
    if (projectName) {
      query.andWhere('project.name = :projectName', { projectName });
    }
    if (runName) {
      query.andWhere('run.name = :runName', { runName });
    }
    if (topics && topics.length > 0) {
      query.andWhere('topic.name IN (:...topics)', { topics });

      query.groupBy('file.uuid').having('COUNT(file.uuid) = :topicCount', {
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
      .leftJoinAndSelect('file.run', 'run')
      .leftJoinAndSelect('run.project', 'project')
      .leftJoinAndSelect('file.topics', 'topic')
      .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
      .getMany();
  }

  async findFiltered(
    fileName: string,
    projectUUID: string,
    runUUID: string,
    startDate: string,
    endDate: string,
    topics: string,
    and_or: boolean,
  ) {
    // Start building your query with basic filters
    const query = this.fileRepository
      .createQueryBuilder('file')
      .select('file.uuid')
      .leftJoin('file.run', 'run')
      .leftJoin('file.topics', 'topic')
      .leftJoin('run.project', 'project');
    // Apply filters for fileName, projectUUID, and date
    if (fileName) {
      query.andWhere('file.filename LIKE :fileName', {
        fileName: `%${fileName}%`,
      });
    }
    if (projectUUID) {
      query.andWhere('project.uuid = :projectUUID', { projectUUID });
    }
    if (runUUID) {
      query.andWhere('run.uuid = :runUUID', { runUUID });
    }
    if (startDate && endDate) {
      query.andWhere('file.date BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    }
    const splitTopics = topics.split(',');
    if (splitTopics && splitTopics.length > 0) {
      query.andWhere('topic.name IN (:...splitTopics)', { splitTopics });

      if (and_or) {
        query.groupBy('file.uuid').having('COUNT(file.uuid) = :topicCount', {
          topicCount: splitTopics.length,
        });
      }
    } // Execute the query
    const fileIds = await query.getMany();
    if (fileIds.length === 0) {
      return [];
    }
    const fileIdsArray = fileIds.map((file) => file.uuid);
    return await this.fileRepository
      .createQueryBuilder('file')
      .leftJoinAndSelect('file.run', 'run')
      .leftJoinAndSelect('run.project', 'project')
      .leftJoinAndSelect('file.topics', 'topic')
      .where('file.uuid IN (:...fileIds)', { fileIds: fileIdsArray })
      .getMany();
  }

  async findOne(uuid: string) {
    return this.fileRepository.findOne({
      where: { uuid },
      relations: ['run', 'topics', 'run.project'],
    });
  }

  async findByFilename(filename: string) {
    return this.fileRepository.findOne({
      where: { filename },
      relations: ['run', 'topics', 'run.project'],
    });
  }

  async update(uuid: string, file: UpdateFile) {
    const db_file = await this.fileRepository.findOne({ where: { uuid } });
    db_file.filename = file.filename;
    db_file.date = file.date;
    if (file.run) {
      db_file.run = await this.runRepository.findOne({
        where: { uuid: file.run.uuid },
      });
    }
    if (file.project) {
      db_file.run.project = await this.projectRepository.findOne({
        where: { uuid: file.project.uuid },
      });
    }
    await this.fileRepository.save(db_file);
    return this.fileRepository.findOne({ where: { uuid } });
  }

  async generateDownload(uuid: string, expires: boolean) {
    console.log('generateDownload', uuid);
    const file = await this.fileRepository.findOneOrFail({
      where: { uuid },
    });
    return await minio.presignedUrl(
      'GET',
      env.MINIO_BAG_BUCKET_NAME,
      file.filename,
      expires ? 4 * 60 * 60 : 604800, // 604800 seconds = 1 week
    );
  }
}
