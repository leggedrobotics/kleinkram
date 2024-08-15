import { ConflictException, Injectable } from '@nestjs/common';
import QueueEntity from '@common/entities/queue/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, MoreThan, Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Mission from '@common/entities/mission/mission.entity';
import { FileLocation, FileState, FileType, UserRole } from '@common/enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import env from '@common/env';
import { externalMinio, getInfoFromMinio } from '../minioHelper';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import { UserService } from '../user/user.service';
import { addAccessConstraints } from '../auth/authHelper';
import FileEntity from '@common/entities/file/file.entity';

function extractFileIdFromUrl(url: string): string | null {
    // Define the regex patterns for file and folder IDs, now including optional /u/[number]/ segments
    const filePattern = /\/file(?:\/u\/\d+)?\/d\/([a-zA-Z0-9_-]+)/;
    const folderPattern = /\/drive(?:\/u\/\d+)?\/folders\/([a-zA-Z0-9_-]+)/;

    // Test the URL against the file pattern
    let match = url.match(filePattern);
    if (match && match[1]) {
        return match[1];
    }

    // Test the URL against the folder pattern
    match = url.match(folderPattern);
    if (match && match[1]) {
        return match[1];
    }

    // Return null if no match is found
    return null;
}

@Injectable()
export class QueueService {
    constructor(
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectQueue('file-queue') private fileProcessingQueue: Queue,
        @InjectQueue('action-queue') private actionQueue: Queue,
        private userservice: UserService,
    ) {}

    async addActionQueue(mission_action_id: string) {
        await this.actionQueue.add('actionProcessQueue', {
            mission_action_id: mission_action_id,
        });
    }

    async createDrive(driveCreate: DriveCreate, user: JWTUser) {
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: driveCreate.missionUUID },
        });
        const creator = await this.userservice.findOneByUUID(user.uuid);
        const fileId = extractFileIdFromUrl(driveCreate.driveURL);

        const newQueue = this.queueRepository.create({
            filename: fileId,
            identifier: fileId,
            state: FileState.AWAITING_PROCESSING,
            location: FileLocation.DRIVE,
            mission,
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
        missionUUID: string,
        user: JWTUser,
    ) {
        const creator = await this.userservice.findOneByUUID(user.uuid);
        const filenameRegex = /^[a-zA-Z0-9_\-\. \[\]\(\)äöüÄÖÜ]+$/;
        const filteredFilenames = filenames.filter(
            (filename) =>
                (filename.endsWith('.bag') || filename.endsWith('.mcap')) &&
                filenameRegex.test(filename),
        );
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });

        const expiry = 2 * 60 * 60;
        const urlPromises = filenames.map(async (filename) => {
            const fileType = filename.endsWith('.bag')
                ? FileType.BAG
                : FileType.MCAP;
            const location = `${mission.project.name}/${mission.name}/${filename}`;
            const tentativeFile = this.fileRepository.create({
                date: new Date(),
                size: 0,
                filename,
                mission,
                creator,
                type: fileType,
                tentative: true,
            });
            try {
                await this.fileRepository.save(tentativeFile);
                const minioURL = await externalMinio.presignedPutObject(
                    fileType === FileType.BAG
                        ? env.MINIO_BAG_BUCKET_NAME
                        : env.MINIO_MCAP_BUCKET_NAME,
                    location,
                    expiry,
                );
                const newQueue = this.queueRepository.create({
                    filename,
                    identifier: location,
                    state: FileState.AWAITING_UPLOAD,
                    location: FileLocation.MINIO,
                    mission,
                    creator,
                });
                await this.queueRepository.save(newQueue);
                return {
                    filename,
                    minioURL,
                    uuid: newQueue.uuid,
                };
            } catch (error) {
                return {
                    filename,
                    minioURL: null,
                    uuid: null,
                    error: 'Non-unique filename',
                };
            }
        });

        const urls = await Promise.all(urlPromises);
        return urls.reduce((acc, { filename, minioURL, uuid, error }) => {
            acc[filename] = { url: minioURL, uuid, error };
            return acc;
        }, {});
    }

    async confirmUpload(uuid: string) {
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: uuid },
            relations: ['mission', 'mission.project'],
        });

        if (queue.state !== FileState.AWAITING_UPLOAD) {
            throw new ConflictException('File is not in uploading state');
        }
        const file = await this.fileRepository.findOneOrFail({
            where: {
                filename: queue.filename,
                mission: { uuid: queue.mission.uuid },
            },
        });

        const fileInfo = await getInfoFromMinio(
            queue.filename.endsWith('.bag') ? FileType.BAG : FileType.MCAP,
            `${queue.mission.project.name}/${queue.mission.name}/${queue.filename}`,
        ).catch(async (err) => {
            await this.fileRepository.remove(file);
            throw new ConflictException('File not found in Minio');
        });

        file.tentative = false;
        file.size = fileInfo.size;
        await this.fileRepository.save(file);

        queue.state = FileState.AWAITING_PROCESSING;
        await this.queueRepository.save(queue);

        await this.fileProcessingQueue.add('processMinioFile', {
            queueUuid: queue.uuid,
        });
    }

    async active(
        startDate: Date,
        userUUID: string,
        skip: number,
        take: number,
    ) {
        const user = await this.userservice.findOneByUUID(userUUID);
        if (user.role === UserRole.ADMIN) {
            return await this.queueRepository.find({
                where: {
                    updatedAt: MoreThan(startDate),
                },
                relations: ['mission', 'mission.project', 'creator'],
                skip,
                take,
                order: {
                    createdAt: 'DESC',
                },
            });
        }
        return addAccessConstraints(
            this.queueRepository
                .createQueryBuilder('queue')
                .leftJoinAndSelect('queue.mission', 'mission')
                .leftJoinAndSelect('mission.project', 'project')
                .leftJoinAndSelect('queue.creator', 'creator')
                .where('queue.updatedAt > :startDate', { startDate }),
            userUUID,
        )
            .skip(skip)
            .take(take)
            .orderBy('queue.createdAt', 'DESC')
            .getMany();
    }

    async forFile(filename: string, missionUUID: string) {
        return this.queueRepository.findOne({
            where: {
                filename,
                mission: { uuid: missionUUID },
            },
            relations: ['creator'],
        });
    }
}
