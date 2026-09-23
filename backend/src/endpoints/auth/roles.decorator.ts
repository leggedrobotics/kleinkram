import { ApiResponse } from '@/decorators';
import { UnauthorizedExceptionDto } from '@kleinkram/api-dto';
import { AccessGroupRights } from '@kleinkram/shared';
import {
    applyDecorators,
    ForbiddenException,
    NotFoundException,
    SetMetadata,
    UseGuards,
} from '@nestjs/common';
import {
    ACCESS_SOURCE_METADATA_KEY,
    AccessSource,
    fromBody,
    fromParameter,
} from './access-source';
import {
    AdminOnlyGuard,
    CancelActionGuard,
    CanEditGroupByGroupUuid,
    CanModifyTriggerGuard,
    CanReadManyMissionsGuard,
    CanReadTriggerGuard,
    CreateActionGuard,
    CreateActionsGuard,
    CreateGuard,
    CreateScriptActionGuard,
    DeleteActionGuard,
    DeleteMetadataGuard,
    FileAccessGuard,
    LoggedInUserGuard,
    MissionAccessGuard,
    MoveFilesGuard,
    MoveMissionToProjectGuard,
    ProjectAccessGuard,
    QueueItemAccessGuard,
    ReadActionGuard,
    ReportActionDiagnosticGuard,
    UserGuard,
} from './guards';

export {
    fromBody,
    fromParameter,
    fromQuery,
    type AccessSource,
} from './access-source';

// Logged-in user route decorator
export function LoggedIn() {
    return applyDecorators(
        SetMetadata('isLoggedIn', true),
        UseGuards(LoggedInUserGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description: 'This endpoint requires a logged-in user.',
        }),
    );
}

// Logged-in user route decorator (not API key)
export function UserOnly() {
    return applyDecorators(
        SetMetadata('isLoggedIn', true),
        UseGuards(UserGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'Not authenticated. API keys are not valid on this endpoint.',
        }),
    );
}

// Admin-only route decorator
export function AdminOnly() {
    return applyDecorators(
        SetMetadata('isAdmin', true),
        UseGuards(AdminOnlyGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description: 'This endpoint requires an admin user. ',
        }),
    );
}

/**
 * Requires READ rights on a project.
 *
 * @param source where the project uuid lives, defaults to the `uuid` route parameter
 */
export function CanReadProject(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

/**
 * Requires CREATE rights on a project.
 *
 * @param source where the project uuid lives, defaults to the `projectUUID` body property
 */
export function CanCreateInProjectByBody(
    source: AccessSource = fromBody('projectUUID'),
) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.CREATE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Create permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

/**
 * Requires WRITE rights on a project.
 *
 * @param source where the project uuid lives, defaults to the `uuid` route parameter
 */
export function CanWriteProject(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Modify permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

/**
 * Requires DELETE rights on a project.
 *
 * @param source where the project uuid lives, defaults to the `uuid` route parameter
 */
export function CanDeleteProject(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Delete permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanCreate() {
    return applyDecorators(
        SetMetadata('CanCreate', true),
        UseGuards(CreateGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have global create permissions. API keys are not valid on this endpoint.',
        }),
    );
}

/**
 * Requires READ rights on a mission.
 *
 * @param source where the mission uuid lives, defaults to the `uuid` route parameter
 */
export function CanReadMission(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanMoveMission() {
    return applyDecorators(
        SetMetadata('CanMoveMission', true),
        UseGuards(MoveMissionToProjectGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

/**
 * Requires READ rights on a file.
 *
 * @param source where the file uuid lives, defaults to the `uuid` route parameter
 */
export function CanReadFile(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(FileAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

/**
 * Requires WRITE rights on a file.
 *
 * @param source where the file uuid lives, defaults to the `uuid` route parameter
 */
export function CanWriteFile(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(FileAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Write permissions on the specified project.',
        }),
    );
}

export function CanMoveFiles() {
    return applyDecorators(
        SetMetadata('CanWriteFile', true),
        UseGuards(MoveFilesGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Write permissions on the specified project.',
        }),
    );
}

/**
 * Requires CREATE rights on a mission.
 *
 * @param source where the mission uuid lives, defaults to the `missionUUID` body property
 */
export function CanCreateInMissionByBody(
    source: AccessSource = fromBody('missionUUID'),
) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.CREATE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Create permissions on the specified project.',
        }),
    );
}

/**
 * Requires WRITE rights on a mission.
 *
 * @param source where the mission uuid lives, defaults to the `missionUUID` body property
 */
export function CanWriteMissionByBody(
    source: AccessSource = fromBody('missionUUID'),
) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Write permissions on the specified project.',
        }),
    );
}

/**
 * Requires DELETE rights on a mission.
 *
 * @param source where the mission uuid lives, defaults to the `uuid` route parameter
 */
export function CanDeleteMission(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
        }),
    );
}

/**
 * Requires DELETE rights on a file.
 *
 * @param source where the file uuid lives, defaults to the `uuid` route parameter
 */
export function CanDeleteFile(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(FileAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
        }),
    );
}

/**
 * Requires DELETE rights on the mission owning the queue entry (ingestion job)
 * addressed by the `uuid` route parameter.
 *
 * The route parameter is an ingestion job uuid, so the guard resolves the owning
 * mission from the database instead of trusting a mission uuid from the request.
 */
export function CanDeleteQueueItem() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        UseGuards(QueueItemAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the mission of this queue entry.',
        }),
    );
}

export function CanReadAction() {
    return applyDecorators(
        SetMetadata('CanReadAction', true),
        UseGuards(ReadActionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

/**
 * Restricts a route to the running action container itself.
 *
 * Only the disposable action key the runner minted for the action named in the
 * route parameter is accepted; user sessions and ordinary CLI keys are not.
 */
export function IsRunningAction() {
    return applyDecorators(
        SetMetadata('IsRunningAction', true),
        UseGuards(ReportActionDiagnosticGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'This endpoint can only be called by the action container itself, using the API key Kleinkram injected into it.',
        }),
    );
}

export function CanCreateAction() {
    return applyDecorators(
        SetMetadata('CanCreateActions', true),
        UseGuards(CreateActionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Create permissions on the specified project.',
        }),
    );
}

export function CanCreateScriptAction() {
    return applyDecorators(
        SetMetadata('CanCreateActions', true),
        UseGuards(CreateScriptActionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have the permissions the script runner template requires on the specified project.',
        }),
    );
}

export function CanCreateActions() {
    return applyDecorators(
        SetMetadata('CanCreateActions', true),
        UseGuards(CreateActionsGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Create permissions on the specified project.',
        }),
    );
}

export function CanDeleteAction() {
    return applyDecorators(
        SetMetadata('CanDeleteAction', true),
        UseGuards(DeleteActionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
        }),
    );
}

export function CanCancelAction() {
    return applyDecorators(
        SetMetadata('CanCancelAction', true),
        UseGuards(CancelActionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Cancel permissions on the specified project.',
        }),
    );
}

/**
 * Requires WRITE rights on the mission metadata is added to.
 *
 * @param source where the mission uuid lives, defaults to the `uuid` route parameter
 */
export function CanAddMetadata(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have AddMetadata permissions on the specified project.',
        }),
    );
}

/**
 * Requires DELETE rights on the mission a metadata value belongs to.
 *
 * @param source where the metadata uuid lives, defaults to the `uuid` route parameter
 */
export function CanDeleteMetadata(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(DeleteMetadataGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have DeleteMetadata permissions on the specified project.',
        }),
    );
}

export function CanEditGroup() {
    return applyDecorators(
        SetMetadata('CanEditGroup', true),
        UseGuards(CanEditGroupByGroupUuid),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Edit permissions on the specified group.',
        }),
    );
}

export function CanReadManyMissions() {
    return applyDecorators(
        SetMetadata('CanReadManyMissions', true),
        UseGuards(CanReadManyMissionsGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanModifyTrigger() {
    return applyDecorators(
        SetMetadata('CanModifyTrigger', true),
        UseGuards(CanModifyTriggerGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have permission to modify this trigger.',
        }),
    );
}

/**
 * Requires READ rights on the trigger's mission, or authorship of the trigger.
 *
 * The mission uuid is read off the trigger addressed by the `uuid` route
 * parameter, so the caller never supplies it. Requests authenticated with an
 * API key are held to the key's own mission scope and get neither the author
 * nor the admin shortcut.
 */
export function CanReadTrigger() {
    return applyDecorators(
        SetMetadata('CanReadTrigger', true),
        UseGuards(CanReadTriggerGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description: 'User does not have Read permissions on this trigger.',
        }),
        ApiResponse({
            status: 404,
            type: NotFoundException,
            description: 'No trigger exists with the given uuid.',
        }),
    );
}
