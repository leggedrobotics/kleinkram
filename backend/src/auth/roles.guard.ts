import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AccessGroupRights, CookieNames, UserRole } from '../enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Apikey from './entities/apikey.entity';
import Account from './entities/account.entity';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';

@Injectable()
export class PublicGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        return true; // Always allow access
    }
}

@Injectable()
export class TokenOrUserGuard extends AuthGuard('jwt') {
    constructor(
        @InjectRepository(Apikey) private tokenRepository: Repository<Apikey>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        if (request.cookies['cli_token']) {
            // const token = await this.tokenRepository.find();
            const token = await this.tokenRepository.findOne({
                where: {
                    apikey: request.cookies[CookieNames.CLI_KEY],
                },
                relations: ['mission'],
            });
            if (request.query.uuid != token.mission.uuid) {
                throw new ForbiddenException('Invalid token');
            }
        } else {
            await super.canActivate(context);
        }
        return true;
    }
}

@Injectable()
export class LoggedInUserGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);
        return true;
    }
}

@Injectable()
export class AdminOnlyGuard extends AuthGuard('jwt') {
    constructor(
        @InjectRepository(Account)
        private accountRepository: Repository<Account>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new UnauthorizedException('User not logged in');
        }

        const userFromDb = await this.accountRepository.findOne({
            where: { oauthID: user.userId },
            relations: ['user'],
        });

        if (userFromDb.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('User is not an admin');
        }

        return true;
    }
}

@Injectable()
export class ReadProjectGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const projectUUID = request.query.uuid;
        return this.projectGuardService.canAccessProject(
            user.userId,
            projectUUID,
        );
    }
}

@Injectable()
export class ReadProjectByNameGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const projectName = request.query.name;
        return this.projectGuardService.canAccessProjectByName(
            user.userId,
            projectName,
        );
    }
}

@Injectable()
export class WriteProjectGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const projectUUID = request.query.uuid;
        return this.projectGuardService.canAccessProject(
            user.userId,
            projectUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class DeleteProjectGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const projectUUID = request.query.uuid;
        return this.projectGuardService.canAccessProject(
            user.userId,
            projectUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class CreateProjectGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        return this.projectGuardService.canCreateProject(user.userId);
    }
}

@Injectable()
export class ReadMissionGuard extends AuthGuard('jwt') {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context); // Ensure the user is authenticated first
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const projectUUID = request.query.uuid;
        return this.missionGuardService.canAccessMission(
            user.userId,
            projectUUID,
        );
    }
}
