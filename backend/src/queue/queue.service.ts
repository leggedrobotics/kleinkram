import { Injectable } from '@nestjs/common';
import QueueEntity from './entities/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Run from '../run/entities/run.entity';
import { FileLocation, FileState } from '../enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import env from '../env';
import { minio } from '../minioHelper';
import logger from '../logger';

function extractFileIdFromUrl(url: string): string | null {
  const regex =
    /drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/|document\/d\/)([a-zA-Z0-9_-]{25,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueEntity)
    private queueRepository: Repository<QueueEntity>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectQueue('file-queue') private fileProcessingQueue: Queue,
    @InjectQueue('analysis-queue') private analysisQueue: Queue,
  ) {}

  async addAnalysisQueue(queueUuid: string) {
    await this.analysisQueue.add('processAnalysisFile', {
      queueUuid: queueUuid,
    });
  }

  async createDrive(driveCreate: DriveCreate) {
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: driveCreate.runUUID },
    });
    const fileId = extractFileIdFromUrl(driveCreate.driveURL);
    const newQueue = this.queueRepository.create({
      filename: fileId,
      identifier: fileId,
      state: FileState.PENDING,
      location: FileLocation.DRIVE,
      run,
    });
    await this.queueRepository.save(newQueue);
    await this.fileProcessingQueue
      .add('processDriveFile', {
        queueUuid: newQueue.uuid,
      })
      .catch((err) => {
        logger.error(err);
      });
    logger.debug('added to queue');
  }

  async handleFileUpload(filenames: string[], runUUID: string) {
    let filteredFilenames = filenames.filter(
      (filename) => filename.endsWith('.bag') || filename.endsWith('.mcap'),
    );
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: runUUID },
    });

    const unique = await Promise.all(
      filteredFilenames.map(async (filename) => {
        const count = await this.queueRepository.count({ where: { filename } });
        return count <= 0;
      }),
    );
    filteredFilenames = filteredFilenames.filter((_, index) => unique[index]);
    const expiry = 2 * 60 * 60;
    const urlPromises = filteredFilenames.map(async (filename) => {
      const minioURL = await minio.presignedPutObject(
        env.MINIO_TEMP_BAG_BUCKET_NAME,
        filename,
        expiry,
      );
      const newQueue = this.queueRepository.create({
        filename,
        identifier: filename,
        state: FileState.AWAITING_UPLOAD,
        location: FileLocation.MINIO,
        run,
      });
      await this.queueRepository.save(newQueue);
      return {
        filename,
        minioURL,
      };
    });

    const urls = await Promise.all(urlPromises);

    console.debug('createPreSignedURLS', urls);

    return urls.reduce((acc, { filename, minioURL }) => {
      acc[filename] = minioURL;
      return acc;
    }, {});
  }

  async confirmUpload(filename: string) {
    console.debug('confirmUpload', filename);
    const queue = await this.queueRepository.findOneOrFail({
      where: { filename: filename },
    });

    queue.state = FileState.PENDING;
    await this.queueRepository.save(queue);

    console.debug('add file to queue', queue.uuid);
    await this.fileProcessingQueue.add('processMinioFile', {
      queueUuid: queue.uuid,
    });
  }

  async active(startDate: Date) {
    return await this.queueRepository.find({
      where: {
        updatedAt: MoreThan(startDate),
      },
      relations: ['run', 'run.project'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async clear() {
    return await this.queueRepository.clear();
  }
}
