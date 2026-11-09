import { AccessSource } from '@/endpoints/auth/access-source';
import { FileAccessGuard } from '@/endpoints/auth/guards/file.guards';
import { MissionAccessGuard } from '@/endpoints/auth/guards/mission.guards';
import { ProjectAccessGuard } from '@/endpoints/auth/guards/project.guards';
import { MissionGuardService } from '@/endpoints/auth/mission-guard.service';
import { FileGuardService } from '@/services/file-guard.service';
import { ProjectGuardService } from '@/services/project-guard.service';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { AccessGroupRights } from '@kleinkram/shared';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

const ACCESSIBLE_UUID = '11111111-1111-4111-8111-111111111111';
const FOREIGN_UUID = '22222222-2222-4222-8222-222222222222';

interface RequestParts {
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: Record<string, unknown>;
}

const user = { uuid: 'user-uuid' } as unknown as UserEntity;

// eslint-disable-next-line @typescript-eslint/no-empty-function
function routeHandler(): void {}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- only used as a name in log output
class TestController {}

/**
 * Builds an execution context whose request carries the given params, query and
 * body, and whose handler declares `accessSource` (plus an optional
 * `accessRight`) as route metadata.
 */
const buildContext = (
    parts: RequestParts,
    accessSource: AccessSource | undefined,
    accessRight: AccessGroupRights = AccessGroupRights.READ,
): { context: ExecutionContext; reflector: Reflector } => {
    const request = {
        params: parts.params ?? {},
        query: parts.query ?? {},
        body: parts.body ?? {},
        user: { user, apiKey: undefined },
    };

    const context = {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => routeHandler,
        getClass: () => TestController,
    } as unknown as ExecutionContext;

    const metadata: Record<string, unknown> = {
        accessRight,
        accessSource,
    };

    const reflector = {
        get: (key: string): unknown => metadata[key],
    } as unknown as Reflector;

    return { context, reflector };
};

describe('Access guards read the uuid from the declared source only', () => {
    describe('MissionAccessGuard', () => {
        let missionGuardService: { canAccessMission: jest.Mock };

        beforeEach(() => {
            missionGuardService = {
                canAccessMission: jest.fn().mockResolvedValue(true),
            };
        });

        const buildGuard = (reflector: Reflector) =>
            new MissionAccessGuard(
                missionGuardService as unknown as MissionGuardService,
                reflector,
            );

        test('a body scoped route ignores a uuid smuggled through the query string', async () => {
            const { context, reflector } = buildContext(
                {
                    params: { uuid: ACCESSIBLE_UUID },
                    query: { uuid: ACCESSIBLE_UUID },
                    body: { missionUUID: FOREIGN_UUID },
                },
                { from: 'body', key: 'missionUUID' },
                AccessGroupRights.DELETE,
            );

            await buildGuard(reflector).canActivate(context);

            expect(missionGuardService.canAccessMission).toHaveBeenCalledWith(
                user,
                FOREIGN_UUID,
                AccessGroupRights.DELETE,
            );
        });

        test('a param scoped route ignores query and body values', async () => {
            const { context, reflector } = buildContext(
                {
                    params: { uuid: ACCESSIBLE_UUID },
                    query: { uuid: FOREIGN_UUID },
                    body: { missionUUID: FOREIGN_UUID, uuid: FOREIGN_UUID },
                },
                { from: 'param', key: 'uuid' },
            );

            await buildGuard(reflector).canActivate(context);

            expect(missionGuardService.canAccessMission).toHaveBeenCalledWith(
                user,
                ACCESSIBLE_UUID,
                AccessGroupRights.READ,
            );
        });

        test('a query scoped route reads the declared query parameter', async () => {
            const { context, reflector } = buildContext(
                {
                    query: { uuid: ACCESSIBLE_UUID },
                    body: { missionUUID: FOREIGN_UUID },
                },
                { from: 'query', key: 'uuid' },
            );

            await buildGuard(reflector).canActivate(context);

            expect(missionGuardService.canAccessMission).toHaveBeenCalledWith(
                user,
                ACCESSIBLE_UUID,
                AccessGroupRights.READ,
            );
        });

        test('access is denied when the route declares no source', async () => {
            const { context, reflector } = buildContext(
                { params: { uuid: ACCESSIBLE_UUID } },
                undefined,
            );

            await expect(
                buildGuard(reflector).canActivate(context),
            ).resolves.toBe(false);
            expect(missionGuardService.canAccessMission).not.toHaveBeenCalled();
        });

        test('access is denied when the declared source is empty', async () => {
            const { context, reflector } = buildContext(
                { params: { uuid: ACCESSIBLE_UUID } },
                { from: 'body', key: 'missionUUID' },
            );

            await expect(
                buildGuard(reflector).canActivate(context),
            ).resolves.toBe(false);
            expect(missionGuardService.canAccessMission).not.toHaveBeenCalled();
        });

        test('access is denied when the declared source holds a repeated query parameter', async () => {
            const { context, reflector } = buildContext(
                { query: { uuid: [ACCESSIBLE_UUID, FOREIGN_UUID] } },
                { from: 'query', key: 'uuid' },
            );

            await expect(
                buildGuard(reflector).canActivate(context),
            ).resolves.toBe(false);
            expect(missionGuardService.canAccessMission).not.toHaveBeenCalled();
        });
    });

    describe('FileAccessGuard', () => {
        test('a param scoped route ignores a uuid smuggled through the query string', async () => {
            const fileGuardService = {
                canAccessFile: jest.fn().mockResolvedValue(true),
            };
            const { context, reflector } = buildContext(
                {
                    params: { uuid: FOREIGN_UUID },
                    query: { uuid: ACCESSIBLE_UUID },
                },
                { from: 'param', key: 'uuid' },
                AccessGroupRights.WRITE,
            );

            const guard = new FileAccessGuard(
                fileGuardService as unknown as FileGuardService,
                reflector,
            );
            await guard.canActivate(context);

            expect(fileGuardService.canAccessFile).toHaveBeenCalledWith(
                user,
                FOREIGN_UUID,
                AccessGroupRights.WRITE,
            );
        });
    });

    describe('ProjectAccessGuard', () => {
        test('a route may declare a non-default parameter name', async () => {
            const projectGuardService = {
                canAccessProject: jest.fn().mockResolvedValue(true),
            };
            const { context, reflector } = buildContext(
                {
                    // `/access-groups/:uuid/projects/:projectUuid`: `uuid` is the
                    // access group, the project lives in `projectUuid`.
                    params: {
                        uuid: FOREIGN_UUID,
                        projectUuid: ACCESSIBLE_UUID,
                    },
                    query: { uuid: FOREIGN_UUID },
                },
                { from: 'param', key: 'projectUuid' },
                AccessGroupRights.WRITE,
            );

            const guard = new ProjectAccessGuard(
                projectGuardService as unknown as ProjectGuardService,
                reflector,
            );
            await guard.canActivate(context);

            expect(projectGuardService.canAccessProject).toHaveBeenCalledWith(
                user,
                ACCESSIBLE_UUID,
                AccessGroupRights.WRITE,
            );
        });
    });
});
