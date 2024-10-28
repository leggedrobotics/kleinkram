import { UserRole } from './enum';

export const redis = { host: 'redis', port: 6379 };

export const systemUser = {
    uuid: '10000000-0000-0000-0000-000000000000',
    name: 'System',
    email: 'infrastructure@leggedrobotics.com',
    role: UserRole.USER,
    avatarUrl: 'https://datasets.leggedrobotics.com/logoRSL.png',
};
