import {
    applyDecorators,
    SetMetadata,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import {
    AddTagGuard,
    AddUserToAccessGroupGuard,
    AdminOnlyGuard,
    CanDeleteMissionGuard,
    CanReadManyMissionsGuard,
    CreateActionGuard,
    CreateActionsGuard,
    CreateGuard,
    CreateInMissionByBodyGuard,
    CreateInProjectByBodyGuard,
    CreateQueueByBodyGuard,
    DeleteFileGuard,
    DeleteProjectGuard,
    DeleteTagGuard,
    IsAccessGroupCreatorByAccessGroupUserGuard,
    IsAccessGroupCreatorByProjectAccessGuard,
    LoggedInUserGuard,
    MoveFilesGuard,
    MoveMissionToProjectGuard,
    PublicGuard,
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

// disable naming-convention rule for enum.ts
/* eslint @typescript-eslint/naming-convention: 0 */

// Public route decorator
export function Public() {
    return applyDecorators(
        SetMetadata('isPublic', true),
        UseGuards(PublicGuard),
    );
}

// Logged-in user route decorator
export function LoggedIn() {
    return applyDecorators(
        SetMetadata('isLoggedIn', true),
        UseGuards(LoggedInUserGuard),
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
    );
}

export function CanReadProject() {
    return applyDecorators(
        SetMetadata('CanReadProject', true),
        UseGuards(ReadProjectGuard),
    );
}

export function CanReadProjectByName() {
    return applyDecorators(
        SetMetadata('CanReadProjectByName', true),
        UseGuards(ReadProjectByNameGuard),
    );
}

export function CanCreateInProjectByBody() {
    return applyDecorators(
        SetMetadata('CanCreateInProjectByBody', true),
        UseGuards(CreateInProjectByBodyGuard),
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
    );
}

export function CanReadMissionByName() {
    return applyDecorators(
        SetMetadata('CanReadMission', true),
        UseGuards(ReadMissionByNameGuard),
    );
}

export function CanMoveMission() {
    return applyDecorators(
        SetMetadata('CanMoveMission', true),
        UseGuards(MoveMissionToProjectGuard),
    );
}

export function CanReadFile() {
    return applyDecorators(
        SetMetadata('CanReadFile', true),
        UseGuards(ReadFileGuard),
    );
}

export function CanReadFileByName() {
    return applyDecorators(
        SetMetadata('CanReadFileByName', true),
        UseGuards(ReadFileByNameGuard),
    );
}

export function CanWriteFile() {
    return applyDecorators(
        SetMetadata('CanWriteFile', true),
        UseGuards(WriteFileGuard),
    );
}

export function CanMoveFiles() {
    return applyDecorators(
        SetMetadata('CanWriteFile', true),
        UseGuards(MoveFilesGuard),
    );
}

export function CanCreateInMissionByBody() {
    return applyDecorators(
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(CreateInMissionByBodyGuard),
    );
}

export function CanWriteMissionByBody() {
    return applyDecorators(
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(WriteMissionByBodyGuard),
    );
}

export function CanDeleteMission() {
    return applyDecorators(
        SetMetadata('CanReadMissionByBody', true),
        UseGuards(CanDeleteMissionGuard),
    );
}

export function CanDeleteFile() {
    return applyDecorators(
        SetMetadata('CanDeleteFile', true),
        UseGuards(DeleteFileGuard),
    );
}

export function CanCreateQueueByBody() {
    return applyDecorators(
        SetMetadata('CanCreateQueueByBody', true),
        UseGuards(CreateQueueByBodyGuard),
    );
}

export function CanReadAction() {
    return applyDecorators(
        SetMetadata('CanReadAction', true),
        UseGuards(ReadActionGuard),
    );
}

export function CanCreateAction() {
    return applyDecorators(
        SetMetadata('CanCreateActions', true),
        UseGuards(CreateActionGuard),
    );
}

export function CanCreateActions() {
    return applyDecorators(
        SetMetadata('CanCreateActions', true),
        UseGuards(CreateActionsGuard),
    );
}

export function CanAddTag() {
    return applyDecorators(
        SetMetadata('CanAddTag', true),
        UseGuards(AddTagGuard),
    );
}

export function CanDeleteTag() {
    return applyDecorators(
        SetMetadata('CanDeleteTag', true),
        UseGuards(DeleteTagGuard),
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

export function IsAccessGroupCreatorByProjectAccess() {
    return applyDecorators(
        SetMetadata('IsAccessGroupCreatorByProjectAccess', true),
        UseGuards(IsAccessGroupCreatorByProjectAccessGuard),
    );
}

export function IsAccessGroupCreatorByAccessGroupUser() {
    return applyDecorators(
        SetMetadata('IsAccessGroupCreatorByAccessGroupUser', true),
        UseGuards(IsAccessGroupCreatorByAccessGroupUserGuard),
    );
}

export function CanReadManyMissions() {
    return applyDecorators(
        SetMetadata('CanReadManyMissions', true),
        UseGuards(CanReadManyMissionsGuard),
    );
}
