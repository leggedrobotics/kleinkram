import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { ProjectGuardService } from '@/services/project-guard.service';
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import {
    BadRequestException,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { BaseGuard } from './base.guards';

interface MissionBody {
    missionUUID?: string;
    missionUuid?: string;
    uuid?: string;
    mission?: string;
    targetProjectUUID?: string;
}

interface TagParameters {
    uuid?: string;
}

@Injectable()
export class ReadMissionGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const missionUUID = request.query.uuid as string | undefined;

        if (!missionUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.READ,
            );
        }

        return this.missionGuardService.canAccessMission(user, missionUUID);
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
            | string[]
            | undefined;

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
export class ReadMissionByNameGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const missionName = request.query.name as string | undefined;
        const projectUuid = request.query.projectUUID as string | undefined;

        if (!missionName || !projectUuid) {
            return false; // Deny access if required parameters not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMissionByName(
                apiKey,
                missionName,
                projectUuid,
                AccessGroupRights.READ,
            );
        }
        return this.missionGuardService.canAccessMissionByName(
            user,
            missionName,
            projectUuid,
        );
    }
}

@Injectable()
export class CreateInMissionByBodyGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody;
        const missionUUID = body.missionUUID ?? body.missionUuid;

        if (!missionUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.CREATE,
            );
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class WriteMissionByBodyGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody;
        const missionUUID = body.missionUUID ?? body.missionUuid;

        if (!missionUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class CanDeleteMissionGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);
        const body = request.body as MissionBody | undefined;
        const params = request.params as TagParameters | undefined;

        let missionUUID: string | undefined;

        if (body) {
            missionUUID = body.uuid ?? body.missionUUID ?? body.missionUuid;
        }

        if (!missionUUID && params) {
            missionUUID = params.uuid;
        }

        if (!missionUUID) {
            throw new BadRequestException(
                'Mission UUID not provided in body or params',
            );
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.DELETE,
            );
        }
        if (user.role === UserRole.ADMIN) {
            return true;
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class AddTagGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody;
        const missionUUID = body.mission;

        if (!missionUUID) {
            return false; // Deny access if mission UUID not provided
        }

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class DeleteTagGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

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
                AccessGroupRights.DELETE,
            );
        }
        return this.missionGuardService.canTagMission(
            user,
            tagUuid,
            AccessGroupRights.WRITE,
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

        const missionUUID = request.query.missionUUID as string | undefined;
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

@Injectable()
export class MigrateMissionByBodyGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody | undefined;
        const missionUUID = body?.missionUUID;
        const targetProjectUUID = body?.targetProjectUUID;

        if (!missionUUID || !targetProjectUUID) {
            throw new BadRequestException(
                'missionUUID and targetProjectUUID are required',
            );
        }
        if (!isUUID(missionUUID) || !isUUID(targetProjectUUID)) {
            throw new BadRequestException(
                'missionUUID and targetProjectUUID must be valid UUIDs',
            );
        }

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move missions');
        }

        return (
            (await this.projectGuardService.canAccessProject(
                user,
                targetProjectUUID,
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
