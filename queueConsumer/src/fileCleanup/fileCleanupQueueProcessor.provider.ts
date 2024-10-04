import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import FileEntity from '@common/entities/file/file.entity';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Job } from 'bull';
import {
    AccessGroupRights,
    FileState,
    QueueState,
    UserRole,
} from '@common/enum';
import QueueEntity from '@common/entities/queue/queue.entity';
import User from '@common/entities/user/user.entity';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectAccessViewEntity } from '@common/viewEntities/ProjectAccessView.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import logger from '../logger';

type CancelUploadJob = Job<{
    uuids: string[];
    missionUUID: string;
    userUUID: string;
}>;

@Processor('file-cleanup')
@Injectable()
export class FileCleanupQueueProcessorProvider {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        @InjectRepository(QueueEntity)
        private queueRepository: Repository<QueueEntity>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        @InjectRepository(ProjectAccessViewEntity)
        private projectAccessView: Repository<ProjectAccessViewEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
    ) {}

    @Process({ concurrency: 1, name: 'cancelUpload' })
    async process(job: CancelUploadJob) {
        const userUUID = job.data.userUUID;
        const uuids = job.data.uuids;
        const missionUUID = job.data.missionUUID;
        const canCancelUpload = await this.canCancelUpload(
            userUUID,
            missionUUID,
        );
        if (!canCancelUpload) {
            logger.debug(`User ${userUUID} can't cancel upload`);
            return;
        }
        await Promise.all(
            uuids.map(async (uuid) => {
                const file = await this.fileRepository.findOne({
                    where: { uuid, mission: { uuid: missionUUID } },
                    relations: ['mission'],
                });
                if (!file) {
                    return;
                }
                if (file.state === FileState.OK) {
                    return;
                }
                const queue = await this.queueRepository.findOne({
                    where: {
                        filename: file.filename,
                        mission: { uuid: file.mission.uuid },
                    },
                });
                queue.state = QueueState.CANCELED;
                await this.queueRepository.save(queue);
                await this.fileRepository.remove(file);
                return;
            }),
        );
    }

    async canCancelUpload(userUUID: string, missionUUID: string) {
        const user = await this.userRepository.findOneOrFail({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const mission = await this.missionRepository.findOneOrFail({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (!mission) {
            return false;
        }

        const canAccessProject = await this.projectAccessView.exists({
            where: {
                projectUUID: mission.project.uuid,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
        if (canAccessProject) {
            return true;
        }
        return await this.missionAccessView.exists({
            where: {
                missionUUID,
                userUUID,
                rights: MoreThanOrEqual(AccessGroupRights.WRITE),
            },
        });
    }
}
