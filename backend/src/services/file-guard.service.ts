import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { ApiKeyEntity } from '@kleinkram/backend-common';
import { FileEntity } from '@kleinkram/backend-common/entities/file/file.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../logger';
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
        user: UserEntity,
        fileUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        user: UserEntity,
        filename: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        apikey: ApiKeyEntity,
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
        apiKey: ApiKeyEntity,
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
            apiKey.mission.project?.uuid === file.mission.project?.uuid &&
            apiKey.rights >= rights
        );
    }

    async canAccessFiles(
        user: UserEntity,
        fileUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
