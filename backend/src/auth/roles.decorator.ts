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
