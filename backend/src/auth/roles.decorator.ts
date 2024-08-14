import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
    PublicGuard,
    LoggedInUserGuard,
    AdminOnlyGuard,
    TokenOrUserGuard,
    ReadProjectGuard,
    WriteProjectGuard,
    ReadProjectByNameGuard,
    CreateProjectGuard,
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
    CreateActionGuard,
    AddTagGuard,
    DeleteTagGuard,
    CanDeleteMissionGuard,
    DeleteFileGuard,
} from './roles.guard';

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

// Admin-only route decorator
export function AdminOnly() {
    return applyDecorators(
        SetMetadata('isAdmin', true),
        UseGuards(AdminOnlyGuard),
    );
}

export function TokenOrUser() {
    return applyDecorators(
        SetMetadata('isTokenOrUser', true),
        UseGuards(TokenOrUserGuard),
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

export function CanCreateProject() {
    return applyDecorators(
        SetMetadata('CanCreateProject', true),
        UseGuards(CreateProjectGuard),
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
        SetMetadata('CanCreateAction', true),
        UseGuards(CreateActionGuard),
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
