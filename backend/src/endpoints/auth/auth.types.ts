import { ApiKeyEntity } from '@kleinkram/backend-common';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { Request } from 'express';

export interface AuthenticatedUser {
    user: UserEntity;
    apiKey?: ApiKeyEntity | null;
}

export interface AuthenticatedRequest extends Request {
    user: AuthenticatedUser;
}
