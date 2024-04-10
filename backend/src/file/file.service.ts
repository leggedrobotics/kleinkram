import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'minio';
import File from './entities/file.entity';
import { UpdateFile } from './entities/update-file.dto';
import { TopicService } from '../topic/topic.service';
import env from '../env';
import Run from '../run/entities/run.entity';

@Injectable()
export class FileService {
  private minio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });
  constructor(
    @InjectRepository(File) private fileRepository: Repository<File>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    private topicService: TopicService,
  ) {}

  async findAll() {
    return this.fileRepository.find({ relations: ['run'] });
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
      .leftJoinAndSelect('file.run', 'run')
      .leftJoinAndSelect('file.topics', 'topic')
      .leftJoinAndSelect('run.project', 'project');

    // Apply filters for fileName, projectUUID, and date
    if (fileName) {
      query.andWhere('file.name LIKE :fileName', { fileName: `%${fileName}%` });
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
    if (topics && topics.length > 0) {
      if (and_or) {
        splitTopics.forEach((topicName, index) => {
          query.andWhere((qb) => {
            const key = `topicName${index}`;
            const subQuery = qb
              .subQuery()
              .select('fileTopic.fileUuid')
              .from('file_topics_topic', 'fileTopic') // Reference the join table
              .leftJoin('topic', 'topic', 'topic.Uuid = fileTopic.topicUuid') // Join with the Topic entities
              .where(`topic.name = :${key}`, { [key]: topicName })
              .getQuery();
            return `file.uuid IN ${subQuery}`;
          });
        });
      } else {
        query.andWhere('topic.name IN (:...splitTopics)', { splitTopics });
      }
    } // Execute the query
    return query.getMany();
  }

  async findOne(uuid: string) {
    return this.fileRepository.findOne({
      where: { uuid },
      relations: ['run', 'topics', 'run.project'],
    });
  }

  async update(uuid: string, file: UpdateFile) {
    const db_file = await this.fileRepository.findOne({ where: { uuid } });
    db_file.identifier = file.name;
    db_file.date = file.date;
    if (file.run) {
      db_file.run = await this.runRepository.findOne({
        where: { uuid: file.run.uuid },
      });
    }
    await this.fileRepository.save(db_file);
    return this.fileRepository.findOne({ where: { uuid } });
  }

  async generateDownload(uuid: string) {
    const file = await this.fileRepository.findOneOrFail({
      where: { uuid },
    });
    const fileURL = await this.minio.presignedUrl(
      'GET',
      env.MINIO_BAG_BUCKET_NAME,
      file.filename,
      24 * 60 * 60,
    );
    return fileURL;
  }
}
