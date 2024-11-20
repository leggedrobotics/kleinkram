import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import { AccessGroupRights, UserRole } from '@common/frontend_shared/enum';
import Mission from '@common/entities/mission/mission.entity';
import { ProjectGuardService } from './projectGuard.service';
import Tag from '@common/entities/tag/tag.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import { isUUID } from 'class-validator';
import logger from '../logger';
import Apikey from '@common/entities/auth/apikey.entity';

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
        user: User,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (isUUID(missionUUID) === false) {
            logger.error(
                `MissionGuard: missionUUID (${missionUUID}) not provided. Requesting ${rights} access.`,
            );
            return false;
        }

        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return await this.canUserAccessMission(user, missionUUID, rights);
    }

    async canAccessMissionByName(
        user: User,
        missionName: string,
        projectUuid: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!missionName || !user) {
            logger.error(
                `MissionGuard: missionName (${missionName}) or User (${user}) not provided. Requesting ${rights} access.`,
            );
            return false;
        }
        const mission = await this.missionRepository.findOne({
            where: { name: missionName, project: { uuid: projectUuid } },
        });

        if (!mission) return false;
        return this.canAccessMission(user, mission.uuid, rights);
    }

    async canTagMission(
        user: User,
        tagUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!tagUUID || !user) {
            logger.error(
                `MissionGuard: tagUUID (${tagUUID}) or User (${user}) not provided. Requesting ${rights} access.`,
            );
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
        return this.canAccessMission(user, tag.mission.uuid, accessRights);
    }

    async canKeyTagMission(
        apikey: Apikey,
        tagUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!tagUUID) {
            throw new ConflictException('Tag UUID not provided');
        }
        const tag = await this.tagRepository.findOne({
            where: { uuid: tagUUID },
            relations: ['mission'],
        });
        return this.canKeyAccessMission(apikey, tag.mission.uuid, rights);
    }

    async canReadManyMissions(
        user: User,
        missionUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!missionUUIDs || !user) {
            logger.error(
                `MissionGuard: missionUUIDs (${missionUUIDs}) or User (${user}) not provided. Requesting READ access.`,
            );
            return false;
        }
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const res = await Promise.all(
            missionUUIDs.map(async (missionUUID) =>
                this.canUserAccessMission(user, missionUUID, rights),
            ),
        );
        return res.every((r) => r);
    }

    async canUserAccessMission(
        user: User,
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
                user,
                mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionAccessView.exists({
            where: {
                missionUUID,
                userUUID: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });
    }

    async canKeyAccessMission(
        apikey: Apikey,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        return apikey.mission.uuid === missionUUID && apikey.rights >= rights;
    }

    async canKeyAccessMissionByName(
        apikey: Apikey,
        missionName: string,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ) {
        if (!missionName) {
            throw new ConflictException('Mission name not provided');
        }
        const mission = await this.missionRepository.findOne({
            where: { name: missionName, project: { uuid: projectUUID } },
        });
        return this.canKeyAccessMission(apikey, mission.uuid, rights);
    }
}
