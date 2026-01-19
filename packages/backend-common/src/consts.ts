import { UserRole } from '@kleinkram/shared';

export const redis = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: 6379,
};

export const systemUser = {
    // valid uuid v4 for system user
    uuid: '00000000-0000-4000-8000-000000000000',
    name: 'System',
    hidden: true,
    email: 'infrastructure@leggedrobotics.com',
    role: UserRole.USER,
    avatarUrl: 'https://datasets.leggedrobotics.com/logoRSL.png',
};
