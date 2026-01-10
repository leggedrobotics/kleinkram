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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('file.id', fileUUID);

        if (apiKey) {
            const result = await this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.DELETE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.DELETE,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('file.id', fileUUID);

        if (apiKey) {
            const result = await this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.READ,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.READ,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('file.name', filename);

        if (apiKey) {
            const result = await this.fileGuardService.canKeyAccessFileByName(
                apiKey,
                filename,
                AccessGroupRights.READ,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.fileGuardService.canAccessFileByName(
            user,
            filename,
            AccessGroupRights.READ,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('file.id', fileUUID);

        if (apiKey) {
            const result = await this.fileGuardService.canKeyAccessFile(
                apiKey,
                fileUUID,
                AccessGroupRights.WRITE,
            );
            this.recordGuardResult(context, result);
            return result;
        }
        const result = await this.fileGuardService.canAccessFile(
            user,
            fileUUID,
            AccessGroupRights.WRITE,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('file.ids', fileUUIDs.join(','));
        this.setAttribute('mission.id', missionUUID);

        if (apiKey) {
            this.recordGuardResult(context, false);
            throw new UnauthorizedException('CLI Keys cannot move files');
        }

        const canDeleteFiles = await this.fileGuardService.canAccessFiles(
            user,
            fileUUIDs,
            AccessGroupRights.DELETE,
        );

        if (!canDeleteFiles) {
            this.recordGuardResult(context, false);
            return false;
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
