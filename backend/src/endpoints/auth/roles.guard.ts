import ApikeyEntity from '@common/entities/auth/apikey.entity';
import {
    AccessGroupRights,
    ActionState,
    KeyTypes,
    UserRole,
} from '@common/frontend_shared/enum';
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

import ActionTemplateEntity from '@common/entities/action/action-template.entity';
import ActionEntity from '@common/entities/action/action.entity';
import { FileGuardService } from '../../services/file-guard.service';
import { ProjectGuardService } from '../../services/project-guard.service';
import { UserService } from '../../services/user.service';
import { ActionGuardService } from './action-guard.service';
import { AuthGuardService } from './auth-guard.service';
import { MissionGuardService } from './mission-guard.service';

@Injectable()
export class PublicGuard implements CanActivate {
    canActivate(): boolean {
        return true; // Always allow access
    }
}

export class BaseGuard extends AuthGuard('jwt') {
    async getUser(context: ExecutionContext) {
        const request = context.switchToHttp().getRequest();
        if (!request.user) {
            await super.canActivate(context); // Ensure the user is authenticated first by reading JWT
        }
        const { user, apiKey } = request.user;
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

@Injectable()
export class ReadProjectGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const projectUUID = request.query.uuid || request.params.uuid;

        if (apiKey) {
            // Check if this is an action API key
            if (
                apiKey.key_type === KeyTypes.ACTION &&
                apiKey.mission?.project?.uuid
            ) {
                // Action keys can only access their associated project
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }
        const projectName = request.query.name;
        return this.projectGuardService.canAccessProjectByName(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }
        const projectUUID = request.body.projectUUID;
        return this.projectGuardService.canAccessProject(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot write projects');
        }
        const projectUUID =
            request.query.uuid || request.body.uuid || request.params.uuid;
        return this.projectGuardService.canAccessProject(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot delete projects');
        }
        const projectUUID =
            request.query.uuid || request.params.uuid || request.body.uuid;
        return this.projectGuardService.canAccessProject(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        const fileUUID =
            request.query.uuid || request.body.uuid || request.params.uuid;

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
export class CreateGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey } = await this.getUser(context);
        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot create projects');
        }
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
        const { user, apiKey, request } = await this.getUser(context);

        const missionUUID = request.query.uuid;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.READ,
            );
        }
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
        const { user, apiKey, request } = await this.getUser(context);
        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot read many missions',
            );
        }
        const missionUUIDs = request.query.uuids;
        return await this.missionGuardService.canReadManyMissions(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        const missionName = request.query.name;
        const projectUuid = request.query.projectUUID;

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMissionByName(
                apiKey,
                missionName,
                projectUuid,
                AccessGroupRights.READ,
            );
        }
        return this.missionGuardService.canAccessMissionByName(
            user,
            missionName,
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
        const { user, apiKey, request } = await this.getUser(context);

        const missionUUID = request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.CREATE,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUID = request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUID =
            request.body.uuid ||
            request.params.uuid ||
            request.body.missionUUID;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.DELETE,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
            missionUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class AddTagGuard extends BaseGuard {
    constructor(
        private missionGuardService: MissionGuardService,
        @InjectRepository(ApikeyEntity)
        private apikeyRepository: Repository<ApikeyEntity>,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUID = request.body.mission;
        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                AccessGroupRights.WRITE,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const taguuid = request.body.uuid || request.param.uuid;

        if (apiKey) {
            return this.missionGuardService.canKeyTagMission(
                apiKey,
                taguuid,
                AccessGroupRights.DELETE,
            );
        }
        return this.missionGuardService.canTagMission(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUID = request.query.missionUUID;
        const projectUUID = request.query.projectUUID;
        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot move missions');
        }
        return (
            (await this.projectGuardService.canAccessProject(
                user,
                projectUUID,
                AccessGroupRights.CREATE,
            )) &&
            (await this.missionGuardService.canAccessMission(
                user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const fileUUID = request.query.uuid ?? request.params.uuid;

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
        const filename = request.query.name;
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
        const fileUUID =
            request.query.uuid || request.body.uuid || request.params.uuid;
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
        const fileUUIDs = request.body.fileUUIDs;
        const missionUUID = request.body.missionUUID;
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

@Injectable()
export class ReadActionGuard extends BaseGuard {
    constructor(private actionGuardService: ActionGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);
        const actionUUID = request.query.uuid;
        if (apiKey) {
            return this.actionGuardService.canKeyAccessAction(
                apiKey,
                actionUUID,
                AccessGroupRights.READ,
            );
        }
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
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUID = request.body.missionUUID;
        const actionTemplateUUID = request.body.templateUUID;
        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                where: { uuid: actionTemplateUUID },
            });

        if (apiKey) {
            return this.missionGuardService.canKeyAccessMission(
                apiKey,
                missionUUID,
                actionTemplate.accessRights,
            );
        }
        return this.missionGuardService.canAccessMission(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);
        const actionUUID = request.body.actionUUID;
        const action = await this.actionRepository.findOneOrFail({
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
        if (action.creator.uuid === user.uuid) {
            return true;
        }

        const missionUUID = action.mission.uuid;
        return this.missionGuardService.canAccessMission(
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
        const { user, apiKey, request } = await this.getUser(context);
        const missionUUIDs = request.body.missionUUIDs;
        const actionTemplateUUID = request.body.templateUUID;
        const actionTemplate =
            await this.actionTemplateRepository.findOneOrFail({
                where: { uuid: actionTemplateUUID },
            });
        if (apiKey) {
            const allCanAccess = await Promise.all(
                missionUUIDs.map((missionUUID) =>
                    this.missionGuardService.canKeyAccessMission(
                        apiKey,
                        missionUUID,
                        actionTemplate.accessRights,
                    ),
                ),
            );
            return allCanAccess.every(Boolean);
        }
        const allCanAccess = await Promise.all(
            missionUUIDs.map((missionUUID) =>
                this.missionGuardService.canAccessMission(
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }
        const projectAccessUUID =
            request.body.projectAccessUUID || request.params.projectAccessUUID;
        return this.authGuardService.canEditAccessGroupByProjectUuid(
            user,
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
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException(
                'CLI Keys cannot check access group creator',
            );
        }

        const aguUUID = request.body.uuid || request.params.uuid;
        return this.authGuardService.canEditAccessGroupByGroupUuid(
            user,
            aguUUID,
        );
    }
}
