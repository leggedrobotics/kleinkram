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
    projectUuid?: string;
}

@Injectable()
export class ProjectAccessGuard extends BaseGuard {
    constructor(
        private projectGuardService: ProjectGuardService,
        private reflector: Reflector,
    ) {
        super();
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const { user, apiKey, request } = await this.getUser(context);

        const requiredRight =
            this.reflector.get<AccessGroupRights | undefined>(
                'accessRight',
                context.getHandler(),
            ) ?? AccessGroupRights.READ;

        const body = request.body as ProjectBody | undefined;
        const params = request.params as ProjectParameters | undefined;
        const projectUUID =
            (request.query.projectUuid as string | undefined) ??
            (request.query.uuid as string | undefined) ??
            params?.projectUuid ??
            params?.uuid ??
            body?.projectUUID ??
            body?.uuid;

        if (!projectUUID) {
            return false; // Deny access if UUID not provided
        }

        if (apiKey) {
            if (requiredRight === AccessGroupRights.READ) {
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
                throw new UnauthorizedException(
                    'CLI Keys cannot read projects',
                );
            } else {
                throw new UnauthorizedException(
                    `CLI Keys cannot perform write/delete/create on projects`,
                );
            }
        }

        return this.projectGuardService.canAccessProject(
            user,
            projectUUID,
            requiredRight,
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
