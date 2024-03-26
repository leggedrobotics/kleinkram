import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Project from '../project/entities/project.entity';
import { Repository } from 'typeorm';
import { Client } from 'minio';
import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import Run from './entities/run.entity';
import { CreateRun } from './entities/create-run.dto';
import { UpdateRun } from './entities/update-run.dto';
import axios from 'axios';
import * as FormData from 'form-data';
import { TopicService } from '../topic/topic.service';
import env from '../env';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import Topic from '../topic/entities/topic.entity';
import { DriveCreate } from './entities/drive-create.dto';
import { google } from 'googleapis';
import * as path from 'path';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = 'grandtourdatasets-5295745f7fab.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

@Injectable()
export class RunService {
  private minio: Client = new Client({
    endPoint: 'minio',
    useSSL: false,
    port: 9000,

    region: 'GUGUS GEWESEN',
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
  });
  constructor(
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectRepository(Project) private projectRepository: Repository<Project>,
    private topicService: TopicService,
  ) {}

  async findAll() {
    return this.runRepository.find({ relations: ['project'] });
  }

  async findFiltered(
    runName: string,
    projectUUID: string,
    startDate: string,
    endDate: string,
    topics: string,
    and_or: boolean,
  ) {
    // Start building your query with basic filters
    const query = this.runRepository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.project', 'project')
      .leftJoinAndSelect('run.topics', 'topic');

    // Apply filters for runName, projectUUID, and date
    if (runName) {
      query.andWhere('run.name LIKE :runName', { runName: `%${runName}%` });
    }
    if (projectUUID) {
      query.andWhere('project.uuid = :projectUUID', { projectUUID });
    }
    if (startDate && endDate) {
      query.andWhere('run.date BETWEEN :startDate AND :endDate', {
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
              .select('runTopic.runUuid')
              .from('run_topics_topic', 'runTopic') // Reference the join table
              .leftJoin('topic', 'topic', 'topic.Uuid = runTopic.topicUuid') // Join with the Topic entity
              .where(`topic.name = :${key}`, { [key]: topicName })
              .getQuery();
            return `run.uuid IN ${subQuery}`;
          });
        });
      } else {
        query.andWhere('topic.name IN (:...splitTopics)', { splitTopics });
      }
    } // Execute the query
    return query.getMany();
  }

  async findOne(uuid: string) {
    return this.runRepository.findOne({
      where: { uuid },
      relations: ['project', 'topics'],
    });
  }

  extractFileIdFromUrl(url: string): string | null {
    const regex =
      /drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/|document\/d\/)([a-zA-Z0-9_-]{25,})/;

    const match = url.match(regex);
    return match ? match[1] : null;
  }
  async processMcapFile(arrayBuffer: ArrayBuffer) {
    const decompressHandlers = await loadDecompressHandlers();

    const buffer = Buffer.from(arrayBuffer);
    const readable = new BufferReadable(buffer);
    const reader = await McapIndexedReader.Initialize({
      readable,
      decompressHandlers,
    });

    const topics: Promise<Topic>[] = [];
    const stats = reader.statistics;
    const duration = stats.messageEndTime - stats.messageStartTime;
    reader.channelsById.forEach((channel) => {
      const schema = reader.schemasById.get(channel.schemaId);
      const nr_messages = stats.channelMessageCounts.get(channel.id);
      const topic = this.topicService.create(
        channel.topic,
        schema.name,
        nr_messages,
        Number(nr_messages) / (Number(duration / 1000n) / 1000),
      );
      topics.push(topic);
    });
    const resolved = await Promise.all(topics);
    return {
      topics: resolved,
      date: new Date(Number(stats.messageStartTime / 1000000n)),
    };
  }
  async convertFile(buffer: Buffer, filename: string) {
    const formData = new FormData();
    formData.append('file', buffer, filename);
    const topics: Topic[] = [];

    const response = await axios.post(
      'http://fastapi_app:8000/newBag',
      formData,
      { responseType: 'arraybuffer' },
    );
    const res = await this.processMcapFile(response.data);
    topics.push(...res.topics);

    return { topics, response, date: res.date };
  }

  async uploadToMinio(response: any, originalname: string) {
    const filename = originalname.replace('.bag', '.mcap');
    await this.minio.putObject(
      env.MINIO_BAG_BUCKET_NAME,
      filename,
      response.data,
      {
        'Content-Type': 'application/octet-stream',
      },
    );
  }

  async createDrive(driveCreate: DriveCreate) {
    const project = await this.projectRepository.findOneOrFail({
      where: { uuid: driveCreate.projectUUID },
    });
    const drive = google.drive({ version: 'v3', auth });
    const fileId = this.extractFileIdFromUrl(driveCreate.driveURL);
    const metadataRes = await drive.files.get({
      fileId: fileId,
      fields: 'name',
    });
    const name = metadataRes.data.name;
    const res = await drive.files.get(
      {
        fileId,
        alt: 'media',
      },
      { responseType: 'stream' },
    );
    const chunks = [];
    const buffer: Buffer = await new Promise((resolve, reject) => {
      res.data
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        })
        .on('error', (err) => {
          console.error('Error downloading file.');
          reject(err);
        });
    });
    const { topics, response, date } = await this.convertFile(buffer, name);
    await this.uploadToMinio(response, name);

    const newRun = this.runRepository.create({
      name: driveCreate.name,
      date,
      project,
      topics,
      filename: name,
      size: buffer.length,
    });

    return this.runRepository.save(newRun);
  }

  async create(createRun: CreateRun, file: Express.Multer.File) {
    const project = await this.projectRepository.findOneOrFail({
      where: { uuid: createRun.projectUUID },
    });
    const { topics, response, date } = await this.convertFile(
      file.buffer,
      file.originalname,
    );
    await this.uploadToMinio(response, file.originalname);

    const newRun = this.runRepository.create({
      name: createRun.name,
      date,
      project,
      topics,
      filename: file.originalname,
      size: file.buffer.length,
    });

    return this.runRepository.save(newRun);
  }

  async update(uuid: string, run: UpdateRun) {
    const db_run = await this.runRepository.findOne({ where: { uuid } });
    db_run.name = run.name;
    db_run.date = run.date;
    const project = await this.projectRepository.findOne({
      where: { uuid: run.project.uuid },
    });
    db_run.project = project;
    await this.runRepository.save(db_run);
    return this.runRepository.findOne({ where: { uuid } });
  }

  async generateDownload(uuid: string) {
    const run = await this.runRepository.findOneOrFail({
      where: { uuid },
    });
    const fileURL = await this.minio.presignedUrl(
      'GET',
      env.MINIO_BAG_BUCKET_NAME,
      run.filename,
      24 * 60 * 60,
    );
    return fileURL;
  }
}

class BufferReadable implements IReadable {
  constructor(private buffer: Buffer) {}

  async size(): Promise<bigint> {
    return BigInt(this.buffer.length);
  }

  async read(offset: bigint, size: bigint): Promise<Uint8Array> {
    // Convert bigint to number for Buffer operations; ensure this doesn't exceed Number.MAX_SAFE_INTEGER
    const start = Number(offset);
    const end = start + Number(size);
    // Slice the buffer to get the specified portion; convert to Uint8Array as expected by the interface
    return new Uint8Array(this.buffer.slice(start, end));
  }
}
