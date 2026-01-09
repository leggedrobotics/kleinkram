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
export class DeleteFileGuard extends BaseGuard {
    constructor(private fileGuardService: FileGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as FileBody | undefined;
        const params = request.params as FileParameters | undefined;
        let fileUUID = request.query.uuid as string | undefined;

        if (!fileUUID && body) {
            fileUUID = body.uuid;
        }

        if (!fileUUID && params) {
            fileUUID = params.uuid;
        }

        if (!fileUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.DELETE,
            );
        }
        return this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class ReadFileGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const params = request.params as FileParameters;
        const fileUUID =
            (request.query.uuid as string | undefined) ?? params.uuid;

        if (!fileUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.READ,
            );
        }
        return this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.READ,
        );
    }
}

@Injectable()
export class ReadFileByNameGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const filename = request.query.name as string | undefined;

        if (!filename) {
            return false; // Deny access if filename not provided
        }

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFileByName(
                apiKey,
                filename,
                AccessGroupRights.READ,
            );
        }
        return this.fileGuardService.canAccessFileByName(
            user,
            filename,
            AccessGroupRights.READ,
        );
    }
}

@Injectable()
export class WriteFileGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as FileBody;
        const params = request.params as FileParameters;
        const fileUUID =
            (request.query.uuid as string | undefined) ??
            body.uuid ??
            params.uuid;

        if (!fileUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class MoveFilesGuard extends BaseGuard {
    constructor(
        private fileGuardService: FileGuardService,
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
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
