import { resolveAccessUuid } from '@/endpoints/auth/access-source';
import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { FileGuardService } from '@/services/file-guard.service';
import { AccessGroupRights } from '@kleinkram/shared';
import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseGuard } from './base.guards';

interface FileBody {
    fileUUIDs?: string[];
    missionUUID?: string;
}

@Injectable()
export class FileAccessGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
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

        // The file uuid is read from exactly the location the route declared.
        // Falling back to another location would let a caller authorize against
        // a different file than the one the handler actually operates on.
        const fileUUID = resolveAccessUuid(this.reflector, context, request);

        if (!fileUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                requiredRight,
            );
        }
        return this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            requiredRight,
        );
    }
}

@Injectable()
export class MoveFilesGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
        private missionGuardService: MissionGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        // `PATCH /files`: both the moved files and the target mission are only
        // ever read from the request body.
        const body = request.body as FileBody;
        const fileUUIDs = body.fileUUIDs;
        const missionUUID = body.missionUUID;

        if (!fileUUIDs || fileUUIDs.length === 0 || !missionUUID) {
            return false; // Deny access if required parameters not provided
        }

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move files');
        }
        const canDeleteFiles = await this.fileGuardService.canAccessFiles(
            user,
            fileUUIDs,
            AccessGroupRights.DELETE,
        );

        if (!canDeleteFiles) {
            return false;
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.CREATE,
        );
    }
}
