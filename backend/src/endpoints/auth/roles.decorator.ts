import {
    applyDecorators,
    ForbiddenException,
    SetMetadata,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import {
    AddTagGuard,
    AddUserToAccessGroupGuard,
    AdminOnlyGuard,
    CanDeleteMissionGuard,
    CanEditGroupByGroupUuid,
    CanReadManyMissionsGuard,
    CreateActionGuard,
    CreateActionsGuard,
    CreateGuard,
    CreateInMissionByBodyGuard,
    CreateInProjectByBodyGuard,
    CreateQueueByBodyGuard,
    DeleteActionGuard,
    DeleteFileGuard,
    DeleteProjectGuard,
    DeleteTagGuard,
    LoggedInUserGuard,
    MoveFilesGuard,
    MoveMissionToProjectGuard,
    ReadActionGuard,
    ReadFileByNameGuard,
    ReadFileGuard,
    ReadMissionByNameGuard,
    ReadMissionGuard,
    ReadProjectByNameGuard,
    ReadProjectGuard,
    UserGuard,
    WriteFileGuard,
    WriteMissionByBodyGuard,
    WriteProjectGuard,
} from './roles.guard';
import { ApiResponse } from '@nestjs/swagger';

// Logged-in user route decorator
export function LoggedIn() {
    return applyDecorators(
        SetMetadata('isLoggedIn', true),
        UseGuards(LoggedInUserGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
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
            type: UnauthorizedException,
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
            type: UnauthorizedException,
            description: 'This endpoint requires an admin user. ',
        }),
    );
}

export function CanReadProject() {
    return applyDecorators(
        SetMetadata('CanReadProject', true),
        UseGuards(ReadProjectGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanReadProjectByName() {
    return applyDecorators(
        SetMetadata('CanReadProjectByName', true),
        UseGuards(ReadProjectByNameGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanCreateInProjectByBody() {
    return applyDecorators(
        SetMetadata('CanCreateInProjectByBody', true),
        UseGuards(CreateInProjectByBodyGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have Create permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanWriteProject() {
    return applyDecorators(
        SetMetadata('CanWriteProject', true),
        UseGuards(WriteProjectGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have Modify permissions on the specified project. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanDeleteProject() {
    return applyDecorators(
        SetMetadata('CanDeleteProject', true),
        UseGuards(DeleteProjectGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
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
            type: UnauthorizedException,
            description:
                'User does not have global create permissions. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanReadMission() {
    return applyDecorators(
        SetMetadata('CanReadMission', true),
        UseGuards(ReadMissionGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanReadMissionByName() {
    return applyDecorators(
        SetMetadata('CanReadMission', true),
        UseGuards(ReadMissionByNameGuard),
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
        SetMetadata('CanReadFile', true),
        UseGuards(ReadFileGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}

export function CanReadFileByName() {
    return applyDecorators(
        SetMetadata('CanReadFileByName', true),
        UseGuards(ReadFileByNameGuard),
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
        SetMetadata('CanWriteFile', true),
        UseGuards(WriteFileGuard),
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
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(CreateInMissionByBodyGuard),
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
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(WriteMissionByBodyGuard),
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
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(CanDeleteMissionGuard),
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
        SetMetadata('CanDeleteFile', true),
        UseGuards(DeleteFileGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Delete permissions on the specified project.',
        }),
    );
}

export function CanCreateQueueByBody() {
    return applyDecorators(
        SetMetadata('CanCreateQueueByBody', true),
        UseGuards(CreateQueueByBodyGuard),
        ApiResponse({
            status: 403,
            type: ForbiddenException,
            description:
                'User does not have Create permissions on the specified project.',
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

export function CanAddTag() {
    return applyDecorators(
        SetMetadata('CanAddTag', true),
        UseGuards(AddTagGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have AddTag permissions on the specified project.',
        }),
    );
}

export function CanDeleteTag() {
    return applyDecorators(
        SetMetadata('CanDeleteTag', true),
        UseGuards(DeleteTagGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User does not have DeleteTag permissions on the specified project.',
        }),
    );
}

export function IsAccessGroupCreator() {
    return applyDecorators(
        SetMetadata('IsAccessGroupCreator', true),
        UseGuards(AddUserToAccessGroupGuard),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
            description:
                'User is not the creator of the access group. API keys are not valid on this endpoint.',
        }),
    );
}

export function CanEditGroup() {
    return applyDecorators(
        SetMetadata('CanEditGroup', true),
        UseGuards(CanEditGroupByGroupUuid),
        ApiResponse({
            status: 401,
            type: UnauthorizedException,
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
            type: UnauthorizedException,
            description:
                'User does not have Read permissions on the specified project.',
        }),
    );
}
