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
import { externalMinio } from '../minioHelper';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';

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
        @InjectRepository(User) private userRepository: Repository<User>,
    ) {}

    async addAnalysisQueue(run_analysis_id: string) {
        await this.analysisQueue.add('processAnalysisFile', {
            run_analysis_id: run_analysis_id,
        });
    }

    async createDrive(driveCreate: DriveCreate, user: JWTUser) {
        const run = await this.runRepository.findOneOrFail({
            where: { uuid: driveCreate.runUUID },
        });
        const creator = await this.userRepository.findOneOrFail({
            where: { googleId: user.userId },
        });
        const fileId = extractFileIdFromUrl(driveCreate.driveURL);
        const newQueue = this.queueRepository.create({
            filename: fileId,
            identifier: fileId,
            state: FileState.PENDING,
            location: FileLocation.DRIVE,
            run,
            creator,
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

    async handleFileUpload(
        filenames: string[],
        runUUID: string,
        user: JWTUser,
    ) {
        const creator = await this.userRepository.findOneOrFail({
            where: { googleId: user.userId },
        });
        const filteredFilenames = filenames.filter(
            (filename) =>
                filename.endsWith('.bag') || filename.endsWith('.mcap'),
        );
        const run = await this.runRepository.findOneOrFail({
            where: { uuid: runUUID },
            relations: ['project'],
        });

        let processedFilenames = filteredFilenames.map((filename) => {
            return {
                filename,
                location: `${run.project.name}/${run.name}/${filename}`,
            };
        });
        const unique = await Promise.all(
            processedFilenames.map(async (filename) => {
                const count = await this.queueRepository.count({
                    where: { identifier: filename.location },
                });
                return count <= 0;
            }),
        );
        processedFilenames = processedFilenames.filter(
            (_, index) => unique[index],
        );
        console.log('processedFilenames', processedFilenames);
        const expiry = 2 * 60 * 60;
        const urlPromises = processedFilenames.map(
            async ({ filename, location }) => {
                const minioURL = await externalMinio.presignedPutObject(
                    env.MINIO_TEMP_BAG_BUCKET_NAME,
                    location,
                    expiry,
                );
                const newQueue = this.queueRepository.create({
                    filename,
                    identifier: location,
                    state: FileState.AWAITING_UPLOAD,
                    location: FileLocation.MINIO,
                    run,
                    creator,
                });
                await this.queueRepository.save(newQueue);
                return {
                    filename,
                    minioURL,
                };
            },
        );

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
            relations: ['run', 'run.project', 'creator'],
            order: {
                createdAt: 'DESC',
            },
        });
    }

    async clear() {
        return await this.queueRepository.query('DELETE FROM "queue_entity"');
    }
}
