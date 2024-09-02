import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { AccessGroupRights, CookieNames, UserRole } from '@common/enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Apikey from '@common/entities/auth/apikey.entity';
import Account from '@common/entities/auth/account.entity';
import { ProjectGuardService } from './projectGuard.service';
import { MissionGuardService } from './missionGuard.service';
import { FileGuardService } from './fileGuard.service';
import Queue from '@common/entities/queue/queue.entity';
import { ActionGuardService } from './actionGuard.service';
import logger from '../logger';
import { AuthGuardService } from './authGuard.service';
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

        if (request.cookies[CookieNames.CLI_KEY]) {
            const token = await this.tokenRepository
                .findOneOrFail({
                    where: {
                        apikey: request.cookies[CookieNames.CLI_KEY],
                    },
                    relations: ['mission'],
                })
                .catch(() => {
                    console.log(
                        'Invalid key: ',
                        request.cookies[CookieNames.CLI_KEY],
                    );
                    throw new ForbiddenException('Invalid key!');
                });

            if (request.query.uuid != token.mission.uuid) {
                throw new ForbiddenException('Invalid key?');
            }
        } else {
            await super.canActivate(context);
            const user = request.user;
            if (!user) {
                throw new UnauthorizedException('User not logged in');
            }
            if (!user.uuid) {
                throw new BadRequestException('Missing User / UUID');
            }
            const canAccess = await this.missionGuardService.canAccessMission(
                request.user.uuid,
                request.query.uuid,
            );
            if (!canAccess) {
                throw new ForbiddenException('User does not have access');
            }
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
            where: { oauthID: user.uuid },
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
            user.uuid,
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
            user.uuid,
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
        const projectUUID = request.query.uuid || request.body.uuid;
        return this.projectGuardService.canAccessProject(
            user.uuid,
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
            user.uuid,
            projectUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class DeleteFileGuard extends AuthGuard('jwt') {
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
        const fileUUID = request.body.uuid;
        return this.fileGuardService.canAccessFile(
            user.uuid,
            fileUUID,
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
        if (!request?.user?.uuid) {
            return false;
        }
        const user = request.user;
        return this.projectGuardService.canCreateProject(user.uuid);
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
            user.uuid,
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
            user.uuid,
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
            user.uuid,
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class CanDeleteMissionGuard extends AuthGuard('jwt') {
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
        const missionUUID = request.body.uuid;
        return this.missionGuardService.canAccessMission(
            user.uuid,
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class AddTagGuard extends AuthGuard('jwt') {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(Apikey) private apikeyRepository: Repository<Apikey>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const missionUUID = request.body.mission;

        if (request.cookies[CookieNames.CLI_KEY]) {
            // const token = await this.apikeyRepository.find();
            const token = await this.apikeyRepository.findOne({
                where: {
                    apikey: request.cookies[CookieNames.CLI_KEY],
                },
                relations: ['mission'],
            });
            if (!token) {
                throw new ForbiddenException('Invalid key');
            }
            if (missionUUID != token.mission.uuid) {
                console.log('Invalid key');
                throw new ForbiddenException('Invalid key');
            }
            return true;
        } else {
            await super.canActivate(context); // Ensure the user is authenticated first
            if (!request.user) {
                return false;
            }
            const user = request.user;
            return this.missionGuardService.canAccessMission(
                user.uuid,
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
    }
}

@Injectable()
export class DeleteTagGuard extends AuthGuard('jwt') {
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
        const taguuid = request.body.uuid;
        return this.missionGuardService.canTagMission(
            user.uuid,
            taguuid,
            AccessGroupRights.DELETE,
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
            user.uuid,
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
                user.uuid,
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                user.uuid,
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
            user.uuid,
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
            user.uuid,
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
            user.uuid,
            fileUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class ReadActionGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        private actionGuardService: ActionGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);

        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const fileUUID = request.query.uuid;
        return this.actionGuardService.canAccessAction(user.uuid, fileUUID);
    }
}

@Injectable()
export class CreateActionGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        private missionGuardService: MissionGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);

        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const missionUUID = request.body.missionUUID;
        return this.missionGuardService.canAccessMission(
            user.uuid,
            missionUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class AddUserToAccessGroupGuard extends AuthGuard('jwt') {
    constructor(
        private reflector: Reflector,
        private authGuardService: AuthGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        await super.canActivate(context);

        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            return false;
        }
        const user = request.user;
        const accessGroupUUID = request.body.uuid;
        return this.authGuardService.canAddUserToAccessGroup(
            user.uuid,
            accessGroupUUID,
        );
    }
}
