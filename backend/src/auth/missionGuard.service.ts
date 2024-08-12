import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectGuardService } from './projectGuard.service';
import Tag from '@common/entities/tag/tag.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import { isUUID } from 'class-validator';

@Injectable()
export class MissionGuardService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(AccessGroup)
        private accessGroupRepository: Repository<AccessGroup>,
        @InjectRepository(Mission)
        private missionRepository: Repository<Mission>,
        private projectGuardService: ProjectGuardService,
        @InjectRepository(Tag)
        private tagRepository: Repository<Tag>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
    ) {}

    async canAccessMission(
        userUUID: string,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (isUUID(userUUID) === false || isUUID(missionUUID) === false) {
            return false;
        }

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
        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                userUUID,
                mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionAccessView.exists({
            where: {
                missionUUID,
                userUUID,
                rights: MoreThanOrEqual(rights),
            },
        });
    }

    async canAccessMissionByName(
        userUUID: string,
        missionName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const mission = await this.missionRepository.findOne({
            where: { name: missionName },
        });
        if (!mission) {
            return true;
        }
        return this.canAccessMission(userUUID, mission.uuid, rights);
    }

    async canTagMission(
        userUUID: string,
        tagUUID: string,
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
        const tag = await this.tagRepository.findOne({
            where: { uuid: tagUUID },
            relations: ['mission'],
        });

        // All interactions with tags except READ are considered WRITE on the mission
        let accessRights = AccessGroupRights.READ;
        if (rights !== AccessGroupRights.READ) {
            accessRights = AccessGroupRights.WRITE;
        }
        return this.canAccessMission(userUUID, tag.mission.uuid, accessRights);
    }
}
