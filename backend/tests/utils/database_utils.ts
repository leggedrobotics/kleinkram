import { DataSource } from 'typeorm';
import process from 'node:process';
import AccessGroup from '@common/entities/auth/accessgroup.entity';
import {
    createAccessGroups,
    createNewUser,
} from '../../src/services/auth.service';
import User from '@common/entities/user/user.entity';
import Account from '@common/entities/auth/account.entity';
import { Providers, UserRole } from '@common/frontend_shared/enum';
import GroupMembership from '@common/entities/auth/group-membership.entity';

import {IsString} from 'class-validator';

const databasePort = process.env['DB_PORT'];

export const db = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: Number.parseInt(databasePort ?? '5432', 10),
    ssl: process.env['DB_SSL'] === 'true',
    username: process.env['DB_USER'] ?? '',
    password: process.env['DB_PASSWORD'] ?? '',
    database: process.env['DB_DATABASE'] ?? '',
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
            .filter((entity) => !entity.tableName.includes('materialized'))
            .filter((entity) => !entity.tableName.includes('worker'))
            .map((entity) => `"${entity.tableName}"`)
            .join(', ');

        await db.query(`TRUNCATE ${tablesToClear} CASCADE;`);
    } catch (error: any) {
        throw new Error(`ERROR: Cleaning test database: ${error.toString()}`);
    }
};

export const mockDbUser = async (
    email: string,
    username = 'Test User',
    role: UserRole = UserRole.USER,
): Promise<string> => {
    // read config from access_config.json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    const config = JSON.parse(fs.readFileSync('access_config.json', 'utf8'));
    const accessGroupRepository = db.getRepository(AccessGroup);
    const groupMembershipRepository = db.getRepository(GroupMembership);
    await createAccessGroups(accessGroupRepository, config);

    const userRepository = db.getRepository(User);
    const accountRepository = db.getRepository(Account);

    // hash the email to create a unique oauthID
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('node:crypto');
    const hash = crypto.createHash('sha256');
    hash.update(email);
    const oauthID = hash.digest('hex');

    await createNewUser(
        config,
        userRepository,
        accountRepository,
        accessGroupRepository,
        groupMembershipRepository,
        {
            oauthID,
            provider: Providers.GOOGLE,
            email: email,
            username: username,
            picture: 'https://example.com/picture.jpg',
        },
    );

    if (role) {
        const user = await userRepository.findOneOrFail({
            where: { email: email },
        });

        user.role = role;
        await userRepository.save(user);
    }

    return (await userRepository.findOneOrFail({ where: { email: email } }))
        .uuid;
};

export const getJwtToken = (user: User): string => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jwt = require('jsonwebtoken');
    return jwt.sign({ uuid: user.uuid }, process.env['JWT_SECRET']);
};

export const getUserFromDb = async (uuid: string) => {
    const userRepository = db.getRepository(User);
    return await userRepository.findOneOrFail({
        where: { uuid: uuid },
    });
};
