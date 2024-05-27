import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
    PublicGuard,
    LoggedInUserGuard,
    AdminOnlyGuard,
    TokenOrUserGuard,
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
