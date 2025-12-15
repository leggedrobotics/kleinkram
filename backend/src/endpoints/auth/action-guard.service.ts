import { ProjectGuardService } from '@/services/project-guard.service';
import { ApiKeyEntity } from '@kleinkram/backend-common';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import logger from '../../logger';
import { MissionGuardService } from './mission-guard.service';

@Injectable()
export class ActionGuardService {
    constructor(
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {}

    async canAccessAction(
        user: UserEntity,
        actionUuid: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!actionUuid || !user) {
            logger.error(
                `ActionGuard: actionUUID (${actionUuid}) or User (${user.uuid}) not provided. Requesting ${rights.toString()} access.`,
            );
            return false;
        }

        if (user.role === UserRole.ADMIN) {
            return true;
        }
        const action = await this.actionRepository.findOne({
            where: { uuid: actionUuid },
            relations: ['mission', 'mission.project'],
        });

        if (!action) return false;
        if (action.mission === undefined)
            throw new Error('Action has no mission');
        if (action.mission.project === undefined)
            throw new Error('Action has no mission');

        const canAccessProject =
            await this.projectGuardService.canAccessProject(
                user,
                action.mission.project.uuid,
                rights,
            );
        if (canAccessProject) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            user,
            action.mission.uuid,
            rights,
        );
    }

    async canKeyAccessAction(
        apikey: ApiKeyEntity,
        actionUuid: string,
        rights: AccessGroupRights = AccessGroupRights.READ,
    ): Promise<boolean> {
        if (!actionUuid) {
            logger.error(
                `ActionGuard: actionUUID (${actionUuid}) not provided. Requesting ${rights.toString()} access.`,
            );
        }
        const action = await this.actionRepository.findOne({
            where: { uuid: actionUuid },
            relations: ['mission'],
        });
        if (!action) {
            return false;
        }

        if (action.mission === undefined)
            throw new Error('Apikey has no mission');

        return (
            apikey.mission.uuid === action.mission.uuid &&
            rights <= apikey.rights
        );
    }
}
