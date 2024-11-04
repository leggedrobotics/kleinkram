import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
    PublicGuard,
    LoggedInUserGuard,
    AdminOnlyGuard,
    ReadProjectGuard,
    WriteProjectGuard,
    ReadProjectByNameGuard,
    DeleteProjectGuard,
    ReadMissionGuard,
    ReadMissionByNameGuard,
    MoveMissionToProjectGuard,
    ReadFileGuard,
    ReadFileByNameGuard,
    WriteFileGuard,
    WriteMissionByBodyGuard,
    CreateQueueByBodyGuard,
    ReadActionGuard,
    AddTagGuard,
    DeleteTagGuard,
    CanDeleteMissionGuard,
    DeleteFileGuard,
    AddUserToAccessGroupGuard,
    IsAccessGroupCreatorByProjectAccessGuard,
    CanReadManyMissionsGuard,
    CreateActionsGuard,
    CreateGuard,
    CreateInMissionByBodyGuard,
    CreateInProjectByBodyGuard,
    UserGuard,
    MoveFilesGuard,
    CreateActionGuard,
} from './roles.guard';

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
    );
}

export function IsAccessGroupCreatorByProjectAccess() {
    return applyDecorators(
        SetMetadata('IsAccessGroupCreatorByProjectAccess', true),
        UseGuards(IsAccessGroupCreatorByProjectAccessGuard),
    );
}

export function CanReadManyMissions() {
    return applyDecorators(
        SetMetadata('CanReadManyMissions', true),
        UseGuards(CanReadManyMissionsGuard),
    );
}
