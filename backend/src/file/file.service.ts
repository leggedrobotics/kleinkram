import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from 'minio';
import { loadDecompressHandlers } from '@mcap/support';
import { McapIndexedReader } from '@mcap/core';

import File from './entities/file.entity';
import { CreateFile } from './entities/create-file.dto';
import { UpdateFile } from './entities/update-file.dto';
import axios from 'axios';
import * as FormData from 'form-data';
import { TopicService } from '../topic/topic.service';
import env from '../env';
import { IReadable } from '@mcap/core/dist/cjs/src/types';
import Topic from '../topic/entities/topic.entity';
import { DriveCreate } from './entities/drive-create.dto';
import { drive_v3, google } from 'googleapis';
import Run from '../run/entities/run.entity';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = 'grandtourdatasets-5295745f7fab.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

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

  extractFileIdFromUrl(url: string): string | null {
    const regex =
      /drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/|document\/d\/)([a-zA-Z0-9_-]{25,})/;
    console.log(url);
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
        Number(nr_messages) / (Number(duration / 1000n) / 1000000),
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
    console.log('converting file', filename);
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
  async handleDriveFolder(folder_id: string, run: Run, drive: drive_v3.Drive) {
    const response = await drive.files.list({
      q: `'${folder_id}' in parents`,
      fields: 'nextPageToken, files(id,name,mimeType)',
    });

    const res = response.data.files.map(async (file) => {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        return this.handleDriveFolder(file.id, run, drive);
      }
      if (file.name.endsWith('.bag')) {
        return this.handleDriveFile(file.id, file.name, run, drive); //Todo prevent server overloading
      }
    });
    const converted = await Promise.all(res);
    return converted.flat();
  }
  async handleDriveFile(
    fileId: string,
    name: string,
    run: Run,
    drive: drive_v3.Drive,
  ) {
    console.log('downloading file', name);
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
    console.log('file downloaded', name);
    const { topics, response, date } = await this.convertFile(buffer, name);
    console.log('file converted', name);
    await this.uploadToMinio(response, name);
    console.log('file uploaded', name);
    const newFile = this.fileRepository.create({
      name,
      date,
      run: run,
      topics,
      filename: name,
      size: buffer.length,
    });
    console.log('file created', name);
    return this.fileRepository.save(newFile);
  }

  async createDrive(driveCreate: DriveCreate) {
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: driveCreate.runUUID },
    });
    const drive = google.drive({ version: 'v3', auth });
    const fileId = this.extractFileIdFromUrl(driveCreate.driveURL);
    const metadataRes = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType',
    });
    console.log(metadataRes.data);
    if (metadataRes.data.mimeType !== 'application/vnd.google-apps.folder') {
      return this.handleDriveFile(fileId, metadataRes.data.name, run, drive);
    }
    return this.handleDriveFolder(fileId, run, drive);
  }

  async create(createFile: CreateFile, file: Express.Multer.File) {
    if (!file.filename.endsWith('.bag')) {
      throw new Error('File is not a bag file');
    }
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: createFile.runUUID },
    });
    const { topics, response, date } = await this.convertFile(
      file.buffer,
      file.originalname,
    );
    await this.uploadToMinio(response, file.originalname);

    const newFile = this.fileRepository.create({
      name: file.originalname,
      date,
      run,
      topics,
      filename: file.originalname,
      size: file.buffer.length,
    });

    return this.fileRepository.save(newFile);
  }

  async update(uuid: string, file: UpdateFile) {
    const db_file = await this.fileRepository.findOne({ where: { uuid } });
    db_file.name = file.name;
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
