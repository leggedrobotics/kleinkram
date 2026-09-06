import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { ProjectGuardService } from '@/services/project-guard.service';
import { AccessGroupRights } from '@kleinkram/shared';
import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseGuard } from './base.guards';

interface MissionBody {
    missionUUID?: string;
    missionUuid?: string;
    uuid?: string;
    mission?: string;
}

interface TagParameters {
    uuid?: string;
}

@Injectable()
export class MissionAccessGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const requiredRight =
            this.reflector.get<AccessGroupRights | undefined>(
                'accessRight',
                context.getHandler(),
            ) ?? AccessGroupRights.READ;

        const body = request.body as MissionBody | undefined;
        const params = request.params as { uuid?: string } | undefined;
        const missionUUID =
            params?.uuid ??
            (request.query.uuid as string | undefined) ??
            (request.query.missionUuid as string | undefined) ??
            (request.query.missionUUID as string | undefined) ??
            body?.missionUUID ??
            body?.missionUuid ??
            body?.uuid ??
            body?.mission;

        if (!missionUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                requiredRight,
            );
        }

        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            requiredRight,
        );
    }
}

@Injectable()
export class CanReadManyMissionsGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);
        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot read many missions',
            );
        }

        const missionUUIDs = request.query.uuids as unknown as
            string[] | undefined;

        if (!missionUUIDs || missionUUIDs.length === 0) {
            return false; // Deny access if UUIDs not provided
        }

        return await this.missionGuardService.canReadManyMissions(
            user,
            missionUUIDs,
        );
    }
}

@Injectable()
export class DeleteTagGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const requiredRight =
            this.reflector.get<AccessGroupRights | undefined>(
                'accessRight',
                context.getHandler(),
            ) ?? AccessGroupRights.DELETE;

        const body = request.body as MissionBody | undefined;
        const params = request.params as TagParameters;
        const tagUuid = body?.uuid ?? params.uuid;

        if (!tagUuid) {
            return false; // Deny access if tag UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyTagMission(
                apiKey,
                tagUuid,
                requiredRight,
            );
        }
        return this.missionGuardService.canTagMission(
            user,
            tagUuid,
            requiredRight === AccessGroupRights.DELETE
                ? AccessGroupRights.WRITE
                : requiredRight,
        );
    }
}

@Injectable()
export class MoveMissionToProjectGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const params = request.params as { uuid?: string } | undefined;
        const missionUUID =
            params?.uuid ?? (request.query.missionUUID as string | undefined);
        const projectUUID = request.query.projectUUID as string | undefined;

        if (!missionUUID || !projectUUID) {
            return false; // Deny access if required parameters not provided
        }

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move missions');
        }
        return (
            (await this.projectGuardService.canAccessProject(
                user,
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                user,
                missionUUID,
                AccessGroupRights.DELETE,
            ))
        );
    }
}
