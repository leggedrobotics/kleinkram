import { ProjectGuardService } from '@/services/project-guard.service';
import { AccessGroupRights, KeyTypes } from '@kleinkram/shared';
import {
    ExecutionContext,
    ForbiddenException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { BaseGuard } from './base.guards';

interface ProjectBody {
    projectUUID?: string;
    uuid?: string;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.id', projectUUID);

        if (apiKey) {
            // Check if this is an action API key
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime type safety for apiKey.key_type
            if (apiKey.key_type === KeyTypes.ACTION) {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime null check: mission and project may not be loaded
                const missionProject = apiKey.mission?.project;

                if (missionProject?.uuid) {
                    // Action keys can only access their associated project
                    if (missionProject.uuid !== projectUUID) {
                        this.recordGuardResult(context, false);
                        throw new ForbiddenException(
                            'Action key cannot access this project',
                        );
                    }
                    this.recordGuardResult(context, true);
                    return true;
                }
            }
            // CLI keys and other keys cannot read projects
            this.recordGuardResult(context, false);
            throw new UnauthorizedException('CLI Keys cannot read projects');
        }

        const result = await this.projectGuardService.canAccessProject(
            user,
            projectUUID,
        );
        this.recordGuardResult(context, result);
        return result;
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

        const projectName = request.query.name as string | undefined;

        if (!projectName) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.name', projectName);

        const result = await this.projectGuardService.canAccessProjectByName(
            user,
            projectName,
        );
        this.recordGuardResult(context, result);
        return result;
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

        const body = request.body as ProjectBody | undefined;
        const projectUUID = body?.projectUUID;

        if (!projectUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.id', projectUUID);

        const result = await this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            AccessGroupRights.CREATE,
        );
        this.recordGuardResult(context, result);
        return result;
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

        const body = request.body as ProjectBody | undefined;
        const params = request.params as ProjectParameters | undefined;
        const projectUUID =
            (request.query.uuid as string | undefined) ??
            body?.uuid ??
            params?.uuid;

        if (!projectUUID) {
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.id', projectUUID);

        const result = await this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            AccessGroupRights.WRITE,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            return false;
        }

        this.setAttribute('project.id', projectUUID);

        const result = await this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            AccessGroupRights.DELETE,
        );
        this.recordGuardResult(context, result);
        return result;
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
            this.recordGuardResult(context, false);
            throw new UnauthorizedException('CLI Keys cannot create projects');
        }
        const result = await this.projectGuardService.canCreate(user);
        this.recordGuardResult(context, result);
        return result;
    }
}
