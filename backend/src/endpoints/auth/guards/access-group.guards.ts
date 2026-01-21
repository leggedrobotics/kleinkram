import { AuthGuardService } from '@/endpoints/auth/auth-guard.service';
import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { BaseGuard } from './base.guards';

interface AccessGroupBody {
    projectAccessUUID?: string;
    uuid?: string;
}

interface AccessGroupParameters {
    projectAccessUUID?: string;
    uuid?: string;
}

@Injectable()
export class IsAccessGroupCreatorByProjectAccessGuard extends BaseGuard {
    constructor(private authGuardService: AuthGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }

        const body = request.body as AccessGroupBody | undefined;
        const params = request.params as AccessGroupParameters | undefined;
        const projectAccessUUID =
            body?.projectAccessUUID ?? params?.projectAccessUUID;

        if (!projectAccessUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.id', projectAccessUUID);

        const result =
            await this.authGuardService.canEditAccessGroupByProjectUuid(
                user,
                projectAccessUUID,
            );
        this.recordGuardResult(context, result);
        return result;
    }
}

@Injectable()
export class CanEditGroupByGroupUuid extends BaseGuard {
    constructor(private authGuardService: AuthGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }

        const body = request.body as AccessGroupBody | undefined;
        const params = request.params as AccessGroupParameters | undefined;
        const aguUUID = body?.uuid ?? params?.uuid;

        if (!aguUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('group.id', aguUUID);

        const result =
            await this.authGuardService.canEditAccessGroupByGroupUuid(
                user,
                aguUUID,
            );
        this.recordGuardResult(context, result);
        return result;
    }
}
