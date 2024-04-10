import { Injectable } from '@nestjs/common';
import QueueEntity from './entities/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Run from '../run/entities/run.entity';
import { FileLocation, FileState } from '../enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateFile } from '../file/entities/create-file.dto';
import env from '../env';

function extractFileIdFromUrl(url: string): string | null {
  const regex =
    /drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/|document\/d\/)([a-zA-Z0-9_-]{25,})/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

async function uploadToMinio(response: any, originalname: string) {
  const filename = originalname.replace('.bag', '.mcap');
  await this.minio.putObject(
    env.MINIO_TEMP_BAG_BUCKET_NAME,
    filename,
    response.data,
    {
      'Content-Type': 'application/octet-stream',
    },
  );
}

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueEntity)
    private queueRepository: Repository<QueueEntity>,
    @InjectRepository(Run) private runRepository: Repository<Run>,
    @InjectQueue('file-queue') private fileProcessingQueue: Queue,
  ) {}

  async createDrive(driveCreate: DriveCreate) {
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: driveCreate.runUUID },
    });
    const fileId = extractFileIdFromUrl(driveCreate.driveURL);
    const newQueue = this.queueRepository.create({
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
        console.log(err);
      });
    console.log('added to queue');
  }

  async create(createFile: CreateFile, file: Express.Multer.File) {
    if (!file.filename.endsWith('.bag')) {
      throw new Error('File is not a bag file');
    }
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: createFile.runUUID },
    });

    await uploadToMinio(file, file.originalname);

    const newQueue = this.queueRepository.create({
      state: FileState.PENDING,
      location: FileLocation.MINIO,
      run,
    });
    await this.queueRepository.save(newQueue);

    await this.fileProcessingQueue.add('processMinioFile', {
      queueUuid: newQueue.uuid,
    });
  }
}
