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
import { FileGuardService } from './fileGuard.service';
import Queue from '../queue/entities/queue.entity';
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
        private missionGuardService: MissionGuardService,
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
            const canAccess = await this.missionGuardService.canAccessMission(
                request.user.uuid,
                request.query.uuid,
            );
            if (!canAccess) {
                throw new ForbiddenException('User does not have access');
            }
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
        const missionUUID = request.query.uuid;
        return this.missionGuardService.canAccessMission(
            user.userId,
            missionUUID,
        );
    }
}

@Injectable()
export class ReadMissionByNameGuard extends AuthGuard('jwt') {
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
        const missionName = request.query.name;
        return this.missionGuardService.canAccessMissionByName(
            user.userId,
            missionName,
        );
    }
}

@Injectable()
export class WriteMissionByBodyGuard extends AuthGuard('jwt') {
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
        const missionUUID = request.body.missionUUID;
        return this.missionGuardService.canAccessMission(
            user.userId,
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class CreateQueueByBodyGuard extends AuthGuard('jwt') {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(Queue)
        private queueRepository: Repository<Queue>,
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
        const queueUUID = request.body.uuid;
        const queue = await this.queueRepository.findOneOrFail({
            where: { uuid: queueUUID },
            relations: ['mission'],
        });

        return this.missionGuardService.canAccessMission(
            user.userId,
            queue.mission.uuid,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class MoveMissionToProjectGuard extends AuthGuard('jwt') {
    constructor(
        private projectGuardService: ProjectGuardService,
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
        const missionUUID = request.query.missionUUID;
        const projectUUID = request.query.projectUUID;
        return (
            (await this.projectGuardService.canAccessProject(
                user.userId,
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                user.userId,
                missionUUID,
                AccessGroupRights.DELETE,
            ))
        );
    }
}

@Injectable()
export class ReadFileGuard extends AuthGuard('jwt') {
    constructor(
        private fileGuardService: FileGuardService,
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
        const fileUUID = request.query.uuid;
        return this.fileGuardService.canAccessFile(
            user.userId,
            fileUUID,
            AccessGroupRights.READ,
        );
    }
}

@Injectable()
export class ReadFileByNameGuard extends AuthGuard('jwt') {
    constructor(
        private fileGuardService: FileGuardService,
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
        const filename = request.query.name;
        return this.fileGuardService.canAccessFileByName(
            user.userId,
            filename,
            AccessGroupRights.READ,
        );
    }
}

@Injectable()
export class WriteFileGuard extends AuthGuard('jwt') {
    constructor(
        private fileGuardService: FileGuardService,
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
        const fileUUID = request.query.uuid;
        return this.fileGuardService.canAccessFile(
            user.userId,
            fileUUID,
            AccessGroupRights.WRITE,
        );
    }
}
