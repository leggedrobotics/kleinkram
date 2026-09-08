import { ApiResponse } from '@/decorators';
import { UnauthorizedExceptionDto } from '@kleinkram/api-dto';
import { AccessGroupRights } from '@kleinkram/shared';
import {
    applyDecorators,
    ForbiddenException,
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
    CreateActionGuard,
    CreateActionsGuard,
    CreateGuard,
    DeleteActionGuard,
    DeleteTagGuard,
    FileAccessGuard,
    LoggedInUserGuard,
    MissionAccessGuard,
    MoveFilesGuard,
    MoveMissionToProjectGuard,
    ProjectAccessGuard,
    QueueItemAccessGuard,
    ReadActionGuard,
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
 * Requires WRITE rights on the mission a tag is added to.
 *
 * @param source where the mission uuid lives, defaults to the `uuid` route parameter
 */
export function CanAddTag(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have AddTag permissions on the specified project.',
        }),
    );
}

/**
 * Requires DELETE rights on the mission a tag belongs to.
 *
 * @param source where the tag uuid lives, defaults to the `uuid` route parameter
 */
export function CanDeleteTag(source: AccessSource = fromParameter()) {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        SetMetadata(ACCESS_SOURCE_METADATA_KEY, source),
        UseGuards(DeleteTagGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have DeleteTag permissions on the specified project.',
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
