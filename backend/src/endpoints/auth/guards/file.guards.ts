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
    uuid?: string;
    fileUUIDs?: string[];
    missionUUID?: string;
}

interface FileParameters {
    uuid?: string;
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

        const body = request.body as FileBody | undefined;
        const params = request.params as FileParameters | undefined;
        const fileUUID =
            (request.query.uuid as string | undefined) ??
            body?.uuid ??
            params?.uuid;

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
