import { ActionGuardService } from '@/endpoints/auth/action-guard.service';
import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionTriggerEntity } from '@kleinkram/backend-common/entities/action/action-trigger.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { AccessGroupRights, ActionState } from '@kleinkram/shared';
import {
    BadRequestException,
    ExecutionContext,
    Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseGuard } from './base.guards';

interface ActionBody {
    missionUUID?: string;
    templateUUID?: string;
    actionUUID?: string;
    missionUUIDs?: string[];
}

@Injectable()
export class CanModifyTriggerGuard extends BaseGuard {
    constructor(
        @InjectRepository(ActionTriggerEntity)
        private actionTriggerRepository: Repository<ActionTriggerEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, request } = await this.getUser(context);

        const params = request.params as { uuid?: string } | undefined;
        const triggerUUID = params?.uuid;

        if (!triggerUUID) {
            return false;
        }

        const trigger = await this.actionTriggerRepository.findOne({
            where: { uuid: triggerUUID },
        });

        if (!trigger) {
            return false;
        }

        return trigger.creatorUuid === user.uuid;
    }
}

@Injectable()
export class ReadActionGuard extends BaseGuard {
    constructor(private actionGuardService: ActionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const actionUUID = request.query.uuid as string | undefined;

        if (!actionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('action.id', actionUUID);

        if (apiKey) {
            const result = await this.actionGuardService.canKeyAccessAction(
                apiKey,
                actionUUID,
                AccessGroupRights.READ,
            );
            this.recordGuardResult(context, result);
            return result;
        }

        const result = await this.actionGuardService.canAccessAction(
            user,
            actionUUID,
        );
        this.recordGuardResult(context, result);
        return result;
    }
}

@Injectable()
export class CreateActionGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as ActionBody | undefined;
        const missionUUID = body?.missionUUID;
        const actionTemplateUUID = body?.templateUUID;

        if (!missionUUID || !actionTemplateUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);
        this.setAttribute('action_template.id', actionTemplateUUID);

        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                where: { uuid: actionTemplateUUID },
            });

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                actionTemplate.accessRights,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            actionTemplate.accessRights,
        );
        this.recordGuardResult(context, result);
        return result;
    }
}

@Injectable()
export class DeleteActionGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as ActionBody | undefined;
        const params = request.params as { uuid?: string } | undefined;
        const actionUUID = body?.actionUUID ?? params?.uuid;

        if (!actionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('action.id', actionUUID);

        const action = await this.actionRepository.findOneOrFail({
            where: { uuid: actionUUID },
            relations: ['mission', 'creator'],
        });

        if (action.mission === undefined) {
            this.recordGuardResult(context, false);
            throw new BadRequestException('Action does not have a mission');
        }
        if (action.creator === undefined) {
            this.recordGuardResult(context, false);
            throw new BadRequestException('Action does not have a creator');
        }

        this.setAttribute('mission.id', action.mission.uuid);

        if (apiKey) {
            this.recordGuardResult(context, false);
            throw new BadRequestException(
                'apiKey in DeleteActionGuard is not supported',
            );
        }
        if (
            !(
                action.state === ActionState.DONE ||
                action.state === ActionState.FAILED ||
                action.state === ActionState.UNPROCESSABLE
            )
        ) {
            this.recordGuardResult(context, false);
            throw new BadRequestException(
                "can't delete action unless its DONE, FAILED or UNPROCESSABLE",
            );
        }
        if (action.creator.uuid === user.uuid) {
            this.recordGuardResult(context, true);
            return true;
        }

        const missionUUID = action.mission.uuid;
        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.DELETE,
        );
        this.recordGuardResult(context, result);
        return result;
    }
}

@Injectable()
export class CreateActionsGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as ActionBody | undefined;
        const missionUUIDs = body?.missionUUIDs;
        const actionTemplateUUID = body?.templateUUID;

        if (!missionUUIDs || missionUUIDs.length === 0 || !actionTemplateUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.ids', missionUUIDs.join(','));
        this.setAttribute('action_template.id', actionTemplateUUID);

        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                where: { uuid: actionTemplateUUID },
            });

        if (apiKey) {
            // canKeyAccessMission is synchronous, use .every() directly
            const result = missionUUIDs.every((missionUUID: string) =>
                this.missionGuardService.canKeyAccessMission(
                    apiKey,
                    missionUUID,
                    actionTemplate.accessRights,
                ),
            );
            this.recordGuardResult(context, result);
            return result;
        }

        const userCanAccessResults = missionUUIDs.map((missionUUID: string) =>
            this.missionGuardService.canAccessMission(
                user,
                missionUUID,
                actionTemplate.accessRights,
            ),
        );
        const allCanAccess = await Promise.all(userCanAccessResults);
        const result = allCanAccess.every(Boolean);
        this.recordGuardResult(context, result);
        return result;
    }
}
