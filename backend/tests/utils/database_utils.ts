import { DataSource } from 'typeorm';
import process from 'node:process';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    create_access_groups,
    create_new_user,
} from '../../src/auth/auth.service';
import User from '@common/entities/user/user.entity';
import Account from '@common/entities/auth/account.entity';
import { Providers, UserRole } from '@common/enum';

export const db = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: parseInt(process.env.DB_PORT, 10),
    ssl: process.env.DB_SSL === 'true',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    entities: [
        '../common/entities/**/*.entity{.ts,.js}',
        '../common/viewEntities/**/*.entity{.ts,.js}',
    ],
});

export const clearAllData = async () => {
    try {
        const entities = db.entityMetadatas;

        // filter out the tables that should not be cleared (e.g. views)
        const tablesToClear = entities
            .filter((entity) => entity.tableName !== undefined)
            .filter((entity) => !entity.tableName.includes('view'))
            .map((entity) => `"${entity.tableName}"`)
            .join(', ');

        await db.query(`TRUNCATE ${tablesToClear} CASCADE;`);
        await db.query(
            'INSERT INTO worker (uuid, "createdAt", "updatedAt", "deletedAt", "identifier", "hostname", "cpuMemory", "hasGPU", "gpuModel", "gpuMemory", "cpuCores", "cpuModel", storage, reachable, "lastSeen") ' +
                "VALUES ('00000000-0000-0000-0000-000000000001', '2021-01-01T00:00:00.000Z', '2021-01-01T00:00:00.000Z', NULL, 'DO_NOT_CHANGE','DO_NOT_CHANGE', 16, false, '', 0, 3, 'Intel Core 2', 1000, true, '2021-01-01T00:00:00.000Z');",
        );
    } catch (error) {
        throw new Error(`ERROR: Cleaning test database: ${error}`);
    }
};

export const mock_db_user = async (
    email: string,
    username: string = 'Test User',
    role: UserRole = undefined,
): Promise<string> => {
    // read config from access_config.json
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('access_config.json', 'utf8'));
    const accessGroupRepository = db.getRepository(AccessGroup);
    await create_access_groups(accessGroupRepository, config);

    const userRepository = db.getRepository(User);
    const accountRepository = db.getRepository(Account);

    // hash the email to create a unique oauthID
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(email);
    const oauthID = hash.digest('base64');

    await create_new_user(
        config,
        userRepository,
        accountRepository,
        accessGroupRepository,
        {
            oauthID,
            provider: Providers.GOOGLE,
            email: email,
            username: username,
            picture: 'https://example.com/picture.jpg',
        },
    );

    if (role) {
        const user = await userRepository.findOne({ where: { email: email } });
        user.role = role;
        await userRepository.save(user);
    }

    return (await userRepository.findOne({ where: { email: email } })).uuid;
};

export const get_jwt_token = async (user: User) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ uuid: user.uuid }, process.env.JWT_SECRET);
};

export const get_user_from_db = async (uuid: string) => {
    const userRepository = db.getRepository(User);
    return await userRepository.findOneOrFail({ where: { uuid: uuid } });
};
