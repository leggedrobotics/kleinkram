import { ApiKeyEntity } from '@kleinkram/backend-common';
import {
    AccessGroupRights,
    ActionState,
    KeyTypes,
    UserRole,
} from '@kleinkram/shared';
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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActionGuardService } from '@/endpoints/auth/action-guard.service';
import { AuthGuardService } from '@/endpoints/auth/auth-guard.service';
import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { FileGuardService } from '@/services/file-guard.service';
import { ProjectGuardService } from '@/services/project-guard.service';
import { UserService } from '@/services/user.service';
import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';

@Injectable()
export class PublicGuard implements CanActivate {
    canActivate(): boolean {
        return true; // Always allow access
    }
}

export class BaseGuard extends AuthGuard('jwt') {
    async getUser(context: ExecutionContext) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const request = context.switchToHttp().getRequest();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (!request.user) {
            await super.canActivate(context); // Ensure the user is authenticated first by reading JWT
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const { user, apiKey } = request.user;
        if (!user) {
            throw new UnauthorizedException('User not logged in');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys are never admins');
        }

        const databaseUser = await this.userService.findOneByUUID(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
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

@Injectable()
export class ReadProjectGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        const projectUUID = request.query.uuid || request.params.uuid;

        if (apiKey) {
            // Check if this is an action API key
            if (
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                apiKey.key_type === KeyTypes.ACTION &&
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                apiKey.mission?.project?.uuid
            ) {
                // Action keys can only access their associated project
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (apiKey.mission.project.uuid !== projectUUID) {
                    throw new ForbiddenException(
                        'Action key cannot access this project',
                    );
                }
                return true;
            }
            // CLI keys and other keys cannot read projects
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.projectGuardService.canAccessProject(user, projectUUID);
    }
}

@Injectable()
export class ReadProjectByNameGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const projectName = request.query.name;
        return this.projectGuardService.canAccessProjectByName(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectName,
        );
    }
}

@Injectable()
export class CreateInProjectByBodyGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const projectUUID = request.body.projectUUID;
        return this.projectGuardService.canAccessProject(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class WriteProjectGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot write projects');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const projectUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.query.uuid || request.body.uuid || request.params.uuid;
        return this.projectGuardService.canAccessProject(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class DeleteProjectGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot delete projects');
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const projectUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.query.uuid || request.params.uuid || request.body.uuid;
        return this.projectGuardService.canAccessProject(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class DeleteFileGuard extends BaseGuard {
    constructor(private fileGuardService: FileGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fileUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.query.uuid || request.body.uuid || request.params.uuid;

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                fileUUID,
                AccessGroupRights.DELETE,
            );
        }
        return this.fileGuardService.canAccessFile(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            fileUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class CreateGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey } = await this.getUser(context);
        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot create projects');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.projectGuardService.canCreate(user);
    }
}

@Injectable()
export class ReadMissionGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.query.uuid;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.READ,
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.missionGuardService.canAccessMission(user, missionUUID);
    }
}

@Injectable()
export class CanReadManyMissionsGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);
        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot read many missions',
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUIDs = request.query.uuids;
        return await this.missionGuardService.canReadManyMissions(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUIDs,
        );
    }
}

@Injectable()
export class ReadMissionByNameGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionName = request.query.name;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const projectUuid = request.query.projectUUID;

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMissionByName(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionName,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                projectUuid,
                AccessGroupRights.READ,
            );
        }
        return this.missionGuardService.canAccessMissionByName(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionName,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectUuid,
        );
    }
}

@Injectable()
export class CreateInMissionByBodyGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.CREATE,
            );
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class WriteMissionByBodyGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,

        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class CanDeleteMissionGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const missionUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.body.uuid ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.params.uuid ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.DELETE,
            );
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class AddTagGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ApiKeyEntity)
        private apikeyRepository: Repository<ApiKeyEntity>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.body.mission;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class DeleteTagGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        const taguuid = request.body.uuid || request.param.uuid;

        if (apiKey) {
            return this.missionGuardService.canKeyTagMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                taguuid,
                AccessGroupRights.DELETE,
            );
        }
        return this.missionGuardService.canTagMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            taguuid,
            AccessGroupRights.WRITE,
        );
    }
}

@Injectable()
export class MoveMissionToProjectGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private missionGuardService: MissionGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.query.missionUUID;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const projectUUID = request.query.projectUUID;
        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move missions');
        }
        return (
            (await this.projectGuardService.canAccessProject(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                user,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                user,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                AccessGroupRights.DELETE,
            ))
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const fileUUID = request.query.uuid ?? request.params.uuid;

        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                fileUUID,
                AccessGroupRights.READ,
            );
        }
        return this.fileGuardService.canAccessFile(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const filename = request.query.name;
        if (apiKey) {
            return this.fileGuardService.canKeyAccessFileByName(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                filename,
                AccessGroupRights.READ,
            );
        }
        return this.fileGuardService.canAccessFileByName(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const fileUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.query.uuid || request.body.uuid || request.params.uuid;
        if (apiKey) {
            return this.fileGuardService.canKeyAccessFile(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                fileUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.fileGuardService.canAccessFile(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const fileUUIDs = request.body.fileUUIDs;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.body.missionUUID;
        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move files');
        }
        const canDeleteFiles = await this.fileGuardService.canAccessFiles(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            fileUUIDs,
            AccessGroupRights.DELETE,
        );

        if (!canDeleteFiles) {
            return false;
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class ReadActionGuard extends BaseGuard {
    constructor(private actionGuardService: ActionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const actionUUID = request.query.uuid;
        if (apiKey) {
            return this.actionGuardService.canKeyAccessAction(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,

                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                actionUUID,
                AccessGroupRights.READ,
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return this.actionGuardService.canAccessAction(user, actionUUID);
    }
}

@Injectable()
export class CreateActionGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUID = request.body.missionUUID;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const actionTemplateUUID = request.body.templateUUID;
        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: { uuid: actionTemplateUUID },
            });

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                apiKey,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                missionUUID,
                actionTemplate.accessRights,
            );
        }
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            missionUUID,
            actionTemplate.accessRights,
        );
    }
}

@Injectable()
export class DeleteActionGuard extends BaseGuard {
    constructor(
        private reflector: Reflector,
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionEntity)
        private actionRepository: Repository<ActionEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const actionUUID = request.body.actionUUID;
        const action = await this.actionRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            where: { uuid: actionUUID },
            relations: ['mission', 'creator'],
        });

        if (action.mission === undefined)
            throw new BadRequestException('Action does not have a mission');
        if (action.creator === undefined)
            throw new BadRequestException('Action does not have a creator');

        if (apiKey) {
            throw new BadRequestException(
                'apiKey in DeleteActionGuard is not supported',
            );
        }
        if (
            !(
                action.state === ActionState.DONE ||
                action.state === ActionState.FAILED ||
                action.state === ActionState.UNPROCESSABLE
            )
        ) {
            throw new BadRequestException(
                "can't delete action unless its DONE, FAILED or UNPROCESSABLE",
            );
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (action.creator.uuid === user.uuid) {
            return true;
        }

        const missionUUID = action.mission.uuid;
        return this.missionGuardService.canAccessMission(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class CreateActionsGuard extends BaseGuard {
    constructor(
        private reflector: Reflector,
        private missionGuardService: MissionGuardService,
        @InjectRepository(ActionTemplateEntity)
        private actionTemplateRepository: Repository<ActionTemplateEntity>,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const missionUUIDs = request.body.missionUUIDs;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        const actionTemplateUUID = request.body.templateUUID;
        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                where: { uuid: actionTemplateUUID },
            });
        if (apiKey) {
            const allCanAccess = await Promise.all(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                missionUUIDs.map((missionUUID: string) =>
                    this.missionGuardService.canKeyAccessMission(
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                        apiKey,
                        missionUUID,
                        actionTemplate.accessRights,
                    ),
                ),
            );
            return allCanAccess.every(Boolean);
        }
        const allCanAccess = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            missionUUIDs.map((missionUUID: string) =>
                this.missionGuardService.canAccessMission(
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
                    user.uuid,

                    missionUUID,
                    actionTemplate.accessRights,
                ),
            ),
        );
        return allCanAccess.every(Boolean);
    }
}

@Injectable()
export class IsAccessGroupCreatorByProjectAccessGuard extends BaseGuard {
    constructor(
        private reflector: Reflector,
        private authGuardService: AuthGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const projectAccessUUID =
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
            request.body.projectAccessUUID || request.params.projectAccessUUID;
        return this.authGuardService.canEditAccessGroupByProjectUuid(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            projectAccessUUID,
        );
    }
}

@Injectable()
export class CanEditGroupByGroupUuid extends BaseGuard {
    constructor(
        private reflector: Reflector,
        private authGuardService: AuthGuardService,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        const aguUUID = request.body.uuid || request.params.uuid;
        return this.authGuardService.canEditAccessGroupByGroupUuid(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            user,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            aguUUID,
        );
    }
}
