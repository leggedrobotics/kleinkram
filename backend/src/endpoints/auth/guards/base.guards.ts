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

        return { user, apiKey, request };
    }
}

@Injectable()
export class LoggedInUserGuard extends BaseGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        await this.getUser(context); // Will throw if not logged in
        return true;
    }
}

@Injectable()
export class UserGuard extends BaseGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { apiKey } = await this.getUser(context); // Will throw if not logged in
        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot access user only data',
            );
        }
        return true;
    }
}

@Injectable()
export class AdminOnlyGuard extends BaseGuard {
    constructor(private userService: UserService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys are never admins');
        }

        const databaseUser = await this.userService.findOneByUUID(
            user.uuid,
            { role: true },
            {},
        );

        if (databaseUser.role !== UserRole.ADMIN) {
            throw new ForbiddenException('User is not an admin');
        }

        return true;
    }
}
