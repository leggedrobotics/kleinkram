import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { ProjectGuardService } from '@/services/project-guard.service';
import { AccessGroupRights, UserRole } from '@kleinkram/shared';
import {
    BadRequestException,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
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
export class ReadMissionGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const missionUUID = request.query.uuid as string | undefined;

        if (!missionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.READ,
            );
            this.recordGuardResult(context, result);
            return result;
        }

        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.ids', missionUUIDs.join(','));

        const result = await this.missionGuardService.canReadManyMissions(
            user,
            missionUUIDs,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.name', missionName);
        this.setAttribute('project.id', projectUuid);

        if (apiKey) {
            const result =
                await this.missionGuardService.canKeyAccessMissionByName(
                    apiKey,
                    missionName,
                    projectUuid,
                    AccessGroupRights.READ,
                );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canAccessMissionByName(
            user,
            missionName,
            projectUuid,
        );
        this.recordGuardResult(context, result);
        return result;
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

        if (user.role === UserRole.ADMIN) {
            return true;
        }

        if (!missionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.CREATE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.CREATE,
        );
        this.recordGuardResult(context, result);
        return result;
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

        if (user.role === UserRole.ADMIN) {
            return true;
        }

        if (!missionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.WRITE,
        );
        this.recordGuardResult(context, result);
        return result;
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

        if (user.role === UserRole.ADMIN) {
            return true;
        }

        if (!missionUUID && params) {
            missionUUID = params.uuid;
        }

        if (!missionUUID) {
            this.recordGuardResult(context, false);
            throw new BadRequestException(
                'Mission UUID not provided in body or params',
            );
        }

        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.DELETE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
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
export class AddTagGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody;
        const missionUUID = body.mission;

        if (!missionUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            const result = this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.WRITE,
        );
        this.recordGuardResult(context, result);
        return result;
    }
}

@Injectable()
export class DeleteTagGuard extends BaseGuard {
    constructor(private missionGuardService: MissionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as MissionBody;
        const params = request.params as TagParameters;
        const tagUuid = body.uuid ?? params.uuid;

        if (!tagUuid) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('tag.id', tagUuid);

        if (apiKey) {
            const result = await this.missionGuardService.canKeyTagMission(
                apiKey,
                tagUuid,
                AccessGroupRights.DELETE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.missionGuardService.canTagMission(
            user,
            tagUuid,
            AccessGroupRights.WRITE,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('mission.id', missionUUID);
        this.setAttribute('project.id', projectUUID);

        if (apiKey) {
            this.recordGuardResult(context, false);
            throw new UnauthorizedException('CLI Keys cannot move missions');
        }

        const result =
            (await this.projectGuardService.canAccessProject(
                user,
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                user,
                missionUUID,
                AccessGroupRights.DELETE,
            ));

        this.recordGuardResult(context, result);
        return result;
    }
}
