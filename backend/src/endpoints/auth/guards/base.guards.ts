import {
    AuthenticatedRequest,
    AuthenticatedUser,
} from '@/endpoints/auth/auth.types';
import { UserService } from '@/services/user.service';
import { UserRole } from '@kleinkram/shared';
import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { context, trace } from '@opentelemetry/api';

@Injectable()
export class PublicGuard implements CanActivate {
    canActivate(): boolean {
        return true; // Always allow access
    }
}

export class BaseGuard extends AuthGuard('jwt') {
    async getUser(
        context: ExecutionContext,
    ): Promise<AuthenticatedUser & { request: AuthenticatedRequest }> {
        const request = context
            .switchToHttp()
            .getRequest<AuthenticatedRequest>();
        // Defensive check: request.user may be undefined at runtime
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!request.user) {
            await super.canActivate(context); // Ensure the user is authenticated first by reading JWT
        }

        const { user, apiKey } = request.user;
        // Defensive check: user may be undefined at runtime
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!user) {
            throw new UnauthorizedException('User not logged in');
        }

        this.setAttribute('user.id', user.uuid);
        return { user, apiKey, request };
    }

    protected setAttribute(
        key: string,
        value: string | number | boolean,
    ): void {
        trace.getSpan(context.active())?.setAttribute(key, value);
    }

    protected recordGuardResult(
        context: ExecutionContext,
        result: boolean,
    ): boolean {
        const guardName = this.constructor.name;
        this.setAttribute(`guard.${guardName}.result`, result);
        this.setAttribute('guard.enriched', true); // Confirm enrichment logic was reached
        return result;
    }
}

@Injectable()
export class LoggedInUserGuard extends BaseGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            await this.getUser(context); // Will throw if not logged in
            this.recordGuardResult(context, true);
            return true;
        } catch (error) {
            this.recordGuardResult(context, false);
            throw error;
        }
    }
}

@Injectable()
export class UserGuard extends BaseGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const { apiKey } = await this.getUser(context); // Will throw if not logged in
            if (apiKey) {
                this.recordGuardResult(context, false);
                throw new UnauthorizedException(
                    'CLI Keys cannot access user only data',
                );
            }
            this.recordGuardResult(context, true);
            return true;
        } catch (error) {
            this.recordGuardResult(context, false);
            throw error;
        }
    }
}

@Injectable()
export class AdminOnlyGuard extends BaseGuard {
    constructor(private userService: UserService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        try {
            const { user, apiKey } = await this.getUser(context);

            if (apiKey) {
                this.recordGuardResult(context, false);
                throw new UnauthorizedException('CLI Keys are never admins');
            }

            const databaseUser = await this.userService.findOneByUUID(
                user.uuid,
                { role: true },
                {},
            );

            if (databaseUser.role !== UserRole.ADMIN) {
                this.recordGuardResult(context, false);
                throw new ForbiddenException('User is not an admin');
            }

            this.recordGuardResult(context, true);
            return true;
        } catch (error) {
            this.recordGuardResult(context, false);
            throw error;
        }
    }
}
