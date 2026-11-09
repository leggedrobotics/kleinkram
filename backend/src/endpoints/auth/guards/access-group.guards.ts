import { AuthGuardService } from '@/endpoints/auth/auth-guard.service';
import {
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { BaseGuard } from './base.guards';

interface AccessGroupBody {
    projectAccessUUID?: string;
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

        // The route parameter wins: a body value must never be able to point the
        // guard at a different project access than the one in the path.
        const body = request.body as AccessGroupBody | undefined;
        const params = request.params as AccessGroupParameters | undefined;
        const projectAccessUUID =
            params?.projectAccessUUID ?? body?.projectAccessUUID;

        if (!projectAccessUUID) {
            return false; // Deny access if UUID not provided
        }

        return this.authGuardService.canEditAccessGroupByProjectUuid(
            user,
            projectAccessUUID,
        );
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

        // Every route using this guard addresses the access group through the
        // route parameter (`/access-groups/:uuid/...`); the body is never read.
        const params = request.params as AccessGroupParameters | undefined;
        const aguUUID = params?.uuid;

        if (!aguUUID) {
            return false; // Deny access if UUID not provided
        }

        return this.authGuardService.canEditAccessGroupByGroupUuid(
            user,
            aguUUID,
        );
    }
}
