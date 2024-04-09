import { Injectable } from '@nestjs/common';
import QueueEntity from './entities/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import { drive_v3, google } from 'googleapis';
import Run from '../run/entities/run.entity';
import { FileLocation, FileState } from '../enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CreateFile } from '../file/entities/create-file.dto';
import env from '../env';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const KEYFILEPATH = 'grandtourdatasets-5295745f7fab.json';

const auth = new google.auth.GoogleAuth({
  keyFile: KEYFILEPATH,
  scopes: SCOPES,
});

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
        return this.handleDriveFile(file.id, run);
      }
    });
    const converted = await Promise.all(res);
    return converted.flat();
  }
  async handleDriveFile(fileId: string, run: Run) {
    const newQueue = this.queueRepository.create({
      name: fileId,
      state: FileState.PENDING,
      location: FileLocation.DRIVE,
      run,
    });
    await this.queueRepository.save(newQueue);
    console.log('adding to queue');
    await this.fileProcessingQueue.add('processDriveFile', {
      queueUuid: newQueue.uuid,
    });
    console.log('added to queue');
  }

  async createDrive(driveCreate: DriveCreate) {
    const run = await this.runRepository.findOneOrFail({
      where: { uuid: driveCreate.runUUID },
    });
    const drive = google.drive({ version: 'v3', auth });
    const fileId = extractFileIdFromUrl(driveCreate.driveURL);
    const metadataRes = await drive.files.get({
      fileId: fileId,
      fields: 'name,mimeType',
    });
    if (metadataRes.data.mimeType !== 'application/vnd.google-apps.folder') {
      return this.handleDriveFile(fileId, run);
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

    await uploadToMinio(file, file.originalname);

    const newQueue = this.queueRepository.create({
      name: file.filename,
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
