import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import User from '@common/entities/user/user.entity';
import FileEntity from '@common/entities/file/file.entity';
import { AccessGroupRights, UserRole } from '@common/enum';

@Injectable()
export class FileGuardService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(FileEntity)
        private fileRepository: Repository<FileEntity>,
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {}
    async canAccessFile(
        userUUID: string,
        fileUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const user = await this.userRepository.findOne({
            where: { uuid: userUUID },
        });
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const file = await this.fileRepository.findOne({
            where: { uuid: fileUUID },
            relations: ['mission', 'mission.project'],
        });
        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                userUUID,
                file.mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            userUUID,
            file.mission.uuid,
            rights,
        );
    }

    async canAccessFileByName(
        userUUID: string,
        filename: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const file = await this.fileRepository.findOne({
            where: { filename: filename },
        });
        return this.canAccessFile(userUUID, file.uuid, rights);
    }
}
