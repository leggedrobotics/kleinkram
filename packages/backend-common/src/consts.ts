import { UserRole } from '@kleinkram/shared';

export const redis = {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: 6379,
};

export const systemUser = {
    uuid: '10000000-0000-0000-0000-000000000000',
    name: 'System',
    hidden: true,
    email: 'infrastructure@leggedrobotics.com',
    role: UserRole.USER,
    avatarUrl: 'https://datasets.leggedrobotics.com/logoRSL.png',
};
