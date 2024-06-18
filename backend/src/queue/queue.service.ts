import { Injectable } from '@nestjs/common';
import QueueEntity from './entities/queue.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, MoreThan, Repository } from 'typeorm';
import { DriveCreate } from './entities/drive-create.dto';
import Mission from '../mission/entities/mission.entity';
import { FileLocation, FileState, UserRole } from '../enum';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import env from '../env';
import { externalMinio } from '../minioHelper';
import logger from '../logger';
import { JWTUser } from '../auth/paramDecorator';
import User from '../user/entities/user.entity';
import Account from '../auth/entities/account.entity';
import { UserService } from '../user/user.service';

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
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectQueue('file-queue') private fileProcessingQueue: Queue,
        @InjectQueue('action-queue') private actionQueue: Queue,
        private userservice: UserService,
    ) {}

    async addActionQueue(mission_action_id: string) {
        await this.actionQueue.add('processActionFile', {
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
            state: FileState.PENDING,
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

        let processedFilenames = filteredFilenames.map((filename) => {
            return {
                filename,
                location: `${mission.project.name}/${mission.name}/${filename}`,
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
        const expiry = 2 * 60 * 60;
        const urlPromises = processedFilenames.map(
            async ({ filename, location }) => {
                const minioURL = await externalMinio.presignedPutObject(
                    filename.endsWith('.bag')
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
            },
        );

        const urls = await Promise.all(urlPromises);

        console.debug('createPreSignedURLS', urls);

        return urls.reduce((acc, { filename, minioURL, uuid }) => {
            acc[filename] = { url: minioURL, uuid };
            return acc;
        }, {});
    }

    async confirmUpload(uuid: string) {
        console.debug('confirmUpload', uuid);
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: uuid },
        });

        queue.state = FileState.PENDING;
        await this.queueRepository.save(queue);

        console.debug('add file to queue', queue.uuid);
        await this.fileProcessingQueue.add('processMinioFile', {
            queueUuid: queue.uuid,
        });
    }

    async active(startDate: Date, userUUID: string) {
        const user = await this.userservice.findOneByUUID(userUUID);
        if (user.role === UserRole.ADMIN) {
            return await this.queueRepository.find({
                where: {
                    updatedAt: MoreThan(startDate),
                },
                relations: ['mission', 'mission.project', 'creator'],
                order: {
                    createdAt: 'DESC',
                },
            });
        }
        return this.queueRepository
            .createQueryBuilder('queue')
            .leftJoinAndSelect('queue.mission', 'mission')
            .leftJoinAndSelect('mission.project', 'project')
            .leftJoinAndSelect('queue.creator', 'creator')
            .leftJoin('project.accessGroups', 'projectAccessGroups')
            .leftJoin('projectAccessGroups.users', 'projectUsers')
            .leftJoin('mission.accessGroups', 'missionAccessGroups')
            .leftJoin('missionAccessGroups.users', 'missionUsers')
            .where('queue.updatedAt > :startDate', { startDate })
            .where(
                new Brackets((qb) => {
                    qb.where('projectUsers.uuid = :user', {
                        user: userUUID,
                    }).orWhere('missionUsers.uuid = :user', { user: userUUID });
                }),
            )
            .getMany();
    }

    async clear() {
        return await this.queueRepository.query('DELETE FROM "queue_entity"');
    }
}
