import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import User from '@common/entities/user/user.entity';
import { AccessGroupRights, UserRole } from '@common/frontend_shared/enum';
import Mission from '@common/entities/mission/mission.entity';
import Tag from '@common/entities/tag/tag.entity';
import { MissionAccessViewEntity } from '@common/viewEntities/MissionAccessView.entity';
import { isUUID } from 'class-validator';
import logger from '../../logger';
import Apikey from '@common/entities/auth/apikey.entity';
import { ProjectGuardService } from '../../services/project-guard.service';

@Injectable()
export class MissionGuardService {
    constructor(
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
    ): Promise<boolean> {
        if (!isUUID(missionUUID)) {
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
    ): Promise<boolean> {
        if (!missionName || !user) {
            logger.error(
                `MissionGuard: missionName (${missionName}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
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
    ): Promise<boolean> {
        if (!tagUUID || !user) {
            logger.error(
                `MissionGuard: tagUUID (${tagUUID}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
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

        if (tag?.mission === undefined) throw new Error('Tag has no mission');

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
    ): Promise<boolean> {
        if (!tagUUID) {
            throw new ConflictException('Tag UUID not provided');
        }
        const tag = await this.tagRepository.findOne({
            where: { uuid: tagUUID },
            relations: ['mission'],
        });

        if (tag?.mission === undefined) throw new Error('Tag has no mission');
        return this.canKeyAccessMission(apikey, tag.mission.uuid, rights);
    }

    async canReadManyMissions(
        user: User,
        missionUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        if (!missionUUIDs || !user) {
            logger.error(
                `MissionGuard: missionUUIDs (${missionUUIDs.toString()}) or User (${user.uuid}) not provided. Requesting READ access.`,
            );
            return false;
        }
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const result = await Promise.all(
            missionUUIDs.map(async (missionUUID) =>
                this.canUserAccessMission(user, missionUUID, rights),
            ),
        );
        return result.every(Boolean);
    }

    async canUserAccessMission(
        user: User,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        const mission = await this.missionRepository.findOne({
            where: { uuid: missionUUID },
            relations: ['project'],
        });
        if (!mission) {
            return false;
        }

        if (mission.project === undefined)
            throw new Error('Mission has no project');

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

    canKeyAccessMission(
        apikey: Apikey,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): boolean {
        return apikey.mission.uuid === missionUUID && apikey.rights >= rights;
    }

    async canKeyAccessMissionByName(
        apikey: Apikey,
        missionName: string,
        projectUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        if (!missionName) {
            throw new ConflictException('Mission name not provided');
        }
        const mission = await this.missionRepository.findOne({
            where: { name: missionName, project: { uuid: projectUUID } },
        });

        if (!mission) return false;
        return this.canKeyAccessMission(apikey, mission.uuid, rights);
    }
}
