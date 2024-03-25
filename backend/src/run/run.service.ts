import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Project from '../project/entities/project.entity';
import { Like, Repository, Between } from 'typeorm';
import { Client } from 'minio';
import { loadDecompressHandlers } from '@mcap/support';
import { BlobReadable } from '@mcap/browser';
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
    console.log('and_or:', and_or);
    if (topics && topics.length > 0) {
      if (and_or) {
        splitTopics.forEach((topic, index) => {
          query.andWhere((qb) => {
            const key = `topicUuid${index}`;
            const subQuery = qb
              .subQuery()
              .select('runTopic.runUuid')
              .from('run_topics_topic', 'runTopic')
              .where(`runTopic.topicUuid = :topicUuid${index}`, {
                [key]: topic,
              })
              .getQuery();
            return `run.Uuid IN ${subQuery}`;
          });
        });
      } else {
        query.andWhere('topic.uuid IN (:...splitTopics)', { splitTopics });
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
    // for await (const message of reader.readMessages()) {
    //   console.log('Message:', message);
    // }

    // At this point, `topics` contains the list of topics found in the MCAP file
    // Here you can call your service to create topics, or perform other actions
    // with the extracted data.
    return {
      topics: resolved,
      date: new Date(Number(stats.messageStartTime / 1000000n)),
    };
  }

  async create(createRun: CreateRun, file: Express.Multer.File) {
    const startTime = new Date();
    const project = await this.projectRepository.findOneOrFail({
      where: { uuid: createRun.projectUUID },
    });
    const formData = new FormData();
    formData.append('file', file.buffer, file.originalname);
    try {
      const response = await axios.post(
        'http://fastapi_app:8000/newBag',
        formData,
        { responseType: 'arraybuffer' },
      );
      const pythonTime = new Date();
      const topics: Topic[] = [];
      let date = new Date();

      try {
        const res = await this.processMcapFile(response.data);
        topics.push(...res.topics);
        date = res.date;
      } catch (error) {
        console.error(error);
      }
      const processed = new Date();

      const filename = file.originalname.replace('.bag', '.mcap');
      await this.minio.putObject(
        env.MINIO_BAG_BUCKET_NAME,
        filename,
        response.data,
        {
          'Content-Type': 'application/octet-stream',
        },
      );
      const uploaded = new Date();
      const newRun = this.runRepository.create({
        name: createRun.name,
        date,
        project,
        topics,
        filename: file.originalname,
      });
      console.log(
        `python: ${(pythonTime.getTime() - startTime.getTime()) / 1000}s, processing: ${(processed.getTime() - pythonTime.getTime()) / 1000}s, uploading: ${(uploaded.getTime() - processed.getTime()) / 1000}s`,
      );
      return this.runRepository.save(newRun);
    } catch (error) {
      console.error(error);
    }
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
    console.log('Updated run:', db_run);
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
