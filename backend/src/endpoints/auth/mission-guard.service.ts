import { ProjectGuardService } from '@/services/project-guard.service';
import { ApiKeyEntity } from '@kleinkram/backend-common';
import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { isUUID } from 'class-validator';
import { MoreThanOrEqual, Repository } from 'typeorm';
import logger from '../../logger';

@Injectable()
export class MissionGuardService {
    constructor(
        @InjectRepository(MissionEntity)
        private missionRepository: Repository<MissionEntity>,
        private projectGuardService: ProjectGuardService,
        @InjectRepository(MetadataEntity)
        private tagRepository: Repository<MetadataEntity>,
        @InjectRepository(MissionAccessViewEntity)
        private missionAccessView: Repository<MissionAccessViewEntity>,
    ) {}

    async canAccessMission(
        user: UserEntity,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        if (!isUUID(missionUUID)) {
            logger.error(
                `MissionGuard: missionUUID (${missionUUID}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!user) {
            return false;
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return await this.canUserAccessMission(user, missionUUID, rights);
    }

    async canAccessMissionByName(
        user: UserEntity,
        missionName: string,
        projectUuid: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        user: UserEntity,
        tagUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        apikey: ApiKeyEntity,
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
        user: UserEntity,
        missionUUIDs: string[],
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!missionUUIDs || !user) {
            logger.error(
                `MissionGuard: missionUUIDs (${missionUUIDs.toString()}) or User (${user.uuid}) not provided. Requesting READ access.`,
            );
            return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
        user: UserEntity,
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
                missionUuid: missionUUID,
                userUuid: user.uuid,
                rights: MoreThanOrEqual(rights),
            },
        });
    }

    canKeyAccessMission(
        apikey: ApiKeyEntity,
        missionUUID: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): boolean {
        return apikey.mission.uuid === missionUUID && apikey.rights >= rights;
    }

    async canKeyAccessMissionByName(
        apikey: ApiKeyEntity,
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
