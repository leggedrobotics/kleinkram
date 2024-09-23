import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/enum';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectGuardService } from './projectGuard.service';
import Tag from '@common/entities/tag/tag.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import { isUUID } from 'class-validator';
import logger from '../logger';

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
            logger.error(
                `MissionGuard: missionUUID (${missionUUID}) or User UUID (${userUUID}) not provided. Requesting ${rights} access.`,
            );
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
        return await this.canUserAccessMission(userUUID, missionUUID, rights);
    }

    async canAccessMissionByName(
        userUUID: string,
        missionName: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!missionName || !userUUID) {
            logger.error(
                `MissionGuard: missionName (${missionName}) or User UUID (${userUUID}) not provided. Requesting ${rights} access.`,
            );
            return false;
        }
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
        if (!tagUUID || !userUUID) {
            logger.error(
                `MissionGuard: tagUUID (${tagUUID}) or User UUID (${userUUID}) not provided. Requesting ${rights} access.`,
            );
            return false;
        }
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

    async canReadManyMissions(
        userUUID: string,
        missionUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!missionUUIDs || !userUUID) {
            logger.error(
                `MissionGuard: missionUUIDs (${missionUUIDs}) or User UUID (${userUUID}) not provided. Requesting READ access.`,
            );
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
        const res = await Promise.all(
            missionUUIDs.map(async (missionUUID) =>
                this.canUserAccessMission(userUUID, missionUUID, rights),
            ),
        );
        return res.every((r) => r);
    }

    async canUserAccessMission(
        userUUID: string,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        const mission = await this.missionRepository.findOne({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (!mission) {
            return false;
        }
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
}
