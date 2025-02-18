import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import FileEntity from '@common/entities/file/file.entity';
import { AccessGroupRights, UserRole } from '@common/frontend_shared/enum';
import logger from '../logger';
import Apikey from '@common/entities/auth/apikey.entity';
import { MissionGuardService } from '../endpoints/auth/mission-guard.service';
import { ProjectGuardService } from './project-guard.service';

@Injectable()
export class FileGuardService {
    constructor(
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {}

    async canAccessFile(
        user: User,
        fileUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!fileUUID || !user) {
            logger.error(
                `FileGuard: File UUID (${fileUUID}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }

        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const file = await this.fileRepository.findOne({
            where: { uuid: fileUUID },
            relations: ['mission', 'mission.project', 'creator'],
        });

        if (!file) return false;

        if (file.mission === undefined) throw new Error('File has no mission');
        if (file.mission.project === undefined)
            throw new Error('File has no project');

        if (file.creator?.uuid === user.uuid) {
            return true;
        }
        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                user,
                file.mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            user,
            file.mission.uuid,
            rights,
        );
    }

    async canAccessFileByName(
        user: User,
        filename: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!filename || !user) {
            logger.error(
                `FileGuard: Filename (${filename}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }
        const file = await this.fileRepository.findOneOrFail({
            where: { filename: filename },
        });
        return this.canAccessFile(user, file.uuid, rights);
    }

    async canKeyAccessFileByName(
        apikey: Apikey,
        filename: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (filename === '') {
            logger.error(
                `FileGuard: Filename (${filename}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }
        const file = await this.fileRepository.findOneOrFail({
            where: { filename: filename },
        });
        return this.canKeyAccessFile(apikey, file.uuid, rights);
    }

    async canKeyAccessFile(
        apiKey: Apikey,
        fileUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const file = await this.fileRepository.findOne({
            where: { uuid: fileUUID },
            relations: ['mission', 'mission.project'],
        });
        if (!file) return false;
        if (file.mission === undefined) throw new Error('File has no mission');

        return (
            apiKey.mission.project.uuid === file.mission.project.uuid &&
            apiKey.rights >= rights
        );
    }

    async canAccessFiles(
        user: User,
        fileUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!fileUUIDs || !user) {
            logger.error(
                `FileGuard: File UUIDs (${fileUUIDs.toString()}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }
        for (const fileUUID of fileUUIDs) {
            if (!(await this.canAccessFile(user, fileUUID, rights))) {
                return false;
            }
        }
        return true;
    }
}
