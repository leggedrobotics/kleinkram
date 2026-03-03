import { ProjectGuardService } from '@/services/project-guard.service';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import {
    BadRequestException,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { BaseGuard } from './base.guards';

interface ProjectBody {
    projectUUID?: string;
    uuid?: string;
    sourceProjectUUID?: string;
    targetProjectUUID?: string;
}

interface ProjectParameters {
    uuid?: string;
}

@Injectable()
export class ReadProjectGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const params = request.params as ProjectParameters;
        const projectUUID =
            (request.query.uuid as string | undefined) ?? params.uuid;

        if (!projectUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            // Check if this is an action API key
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type safety for apiKey.key_type
            if (apiKey.key_type === KeyTypes.ACTION) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime null check: mission and project may not be loaded
                const missionProject = apiKey.mission?.project;

                if (missionProject?.uuid) {
                    // Action keys can only access their associated project
                    if (missionProject.uuid !== projectUUID) {
                        throw new ForbiddenException(
                            'Action key cannot access this project',
                        );
                    }
                    return true;
                }
            }
            // CLI keys and other keys cannot read projects
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        return this.projectGuardService.canAccessProject(user, projectUUID);
    }
}

@Injectable()
export class ReadProjectByNameGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        const projectName = request.query.name as string | undefined;

        if (!projectName) {
            return false; // Deny access if project name not provided
        }

        return this.projectGuardService.canAccessProjectByName(
            user,
            projectName,
        );
    }
}

@Injectable()
export class CreateInProjectByBodyGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        const body = request.body as ProjectBody | undefined;
        const projectUUID = body?.projectUUID;

        if (!projectUUID) {
            return false; // Deny access if project UUID not provided
        }

        return this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            AccessGroupRights.CREATE,
        );
    }
}

@Injectable()
export class WriteProjectGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot write projects');
        }

        const body = request.body as ProjectBody | undefined;
        const params = request.params as ProjectParameters | undefined;
        const projectUUID =
            (request.query.uuid as string | undefined) ??
            body?.uuid ??
            params?.uuid;

        if (!projectUUID) {
            return false; // Deny access if UUID not provided
        }

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

        const body = request.body as ProjectBody | undefined;
        const params = request.params as ProjectParameters | undefined;
        const projectUUID =
            (request.query.uuid as string | undefined) ??
            params?.uuid ??
            body?.uuid;

        if (!projectUUID) {
            return false; // Deny access if UUID not provided
        }

        return this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            AccessGroupRights.DELETE,
        );
    }
}

@Injectable()
export class CreateGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
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
export class MigrateProjectByBodyGuard extends BaseGuard {
    constructor(private projectGuardService: ProjectGuardService) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const body = request.body as ProjectBody | undefined;
        const sourceProjectUUID = body?.sourceProjectUUID;
        const targetProjectUUID = body?.targetProjectUUID;

        if (!sourceProjectUUID || !targetProjectUUID) {
            throw new BadRequestException(
                'sourceProjectUUID and targetProjectUUID are required',
            );
        }
        if (!isUUID(sourceProjectUUID) || !isUUID(targetProjectUUID)) {
            throw new BadRequestException(
                'sourceProjectUUID and targetProjectUUID must be valid UUIDs',
            );
        }

        if (apiKey) {
            throw new UnauthorizedException('CLI Keys cannot migrate projects');
        }

        return (
            (await this.projectGuardService.canAccessProject(
                user,
                sourceProjectUUID,
                AccessGroupRights.DELETE,
            )) &&
            (await this.projectGuardService.canAccessProject(
                user,
                targetProjectUUID,
                AccessGroupRights.CREATE,
            ))
        );
    }
}
