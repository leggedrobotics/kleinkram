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
    ReadActionGuard,
    UserGuard,
} from './guards';

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

export function CanReadProject() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanCreateInProjectByBody() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.CREATE),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Create permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanWriteProject() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        UseGuards(ProjectAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have Modify permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanDeleteProject() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
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

export function CanReadMission() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
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

export function CanReadFile() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.READ),
        UseGuards(FileAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanWriteFile() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
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

export function CanCreateInMissionByBody() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.CREATE),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Create permissions on the specified project.',
        }),
    );
}

export function CanWriteMissionByBody() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Write permissions on the specified project.',
        }),
    );
}

export function CanDeleteMission() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
        }),
    );
}

export function CanDeleteFile() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
        UseGuards(FileAccessGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
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

export function CanAddTag() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.WRITE),
        UseGuards(MissionAccessGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedExceptionDto,
            description:
                'User does not have AddTag permissions on the specified project.',
        }),
    );
}

export function CanDeleteTag() {
    return applyDecorators(
        SetMetadata('accessRight', AccessGroupRights.DELETE),
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
