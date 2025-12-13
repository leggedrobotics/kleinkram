import {
    AccessGroupEntity,
    AccountEntity,
    AffiliationGroupService,
    ALL_ENTITIES,
    GroupMembershipEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { Providers, UserRole } from '@kleinkram/shared';
import jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

import { createNewUser } from '@/services/auth.service';
import path from 'node:path';
import process from 'node:process';
import { DataSource } from 'typeorm';

const databasePort = process.env.DB_PORT;

export const database = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: Number.parseInt(databasePort ?? '5432', 10),
    ssl: process.env.DB_SSL === 'true',
    username: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? '',
    synchronize: false,
    entities: ALL_ENTITIES,
});

export const clearAllData = async () => {
    try {
        const entities = database.entityMetadatas;

        // filter out the tables that should not be cleared (e.g. views)
        const tablesToClear = entities
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            .filter((entity) => entity.tableName !== undefined)
            .filter((entity) => !entity.tableName.includes('view'))
            .filter((entity) => !entity.tableName.includes('materialized'))
            .filter((entity) => !entity.tableName.includes('worker'))
            .map((entity) => `"${entity.tableName}"`)
            .join(', ');

        await database.query(`TRUNCATE ${tablesToClear} CASCADE;`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        throw new Error(`ERROR: Cleaning test database: ${error.toString()}`);
    }
};

export const mockDatabaseUser = async (
    email: string,
    username = 'Test User',
    role: UserRole = UserRole.USER,
): Promise<string> => {
    // read config from access_config.json
    // eslint-disable-next-line unicorn/prefer-module
    const configPath = path.join(__dirname, '../../src/access_config.json');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const accessGroupRepository = database.getRepository(AccessGroupEntity);
    const groupMembershipRepository = database.getRepository(
        GroupMembershipEntity,
    );
    const affiliationGroupService = new AffiliationGroupService(
        accessGroupRepository,
        groupMembershipRepository,
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await affiliationGroupService.createAccessGroups(config);

    const userRepository = database.getRepository(UserEntity);
    const accountRepository = database.getRepository(AccountEntity);

    // hash the email to create a unique oauthID
    const hash = crypto.createHash('sha256');
    hash.update(email);
    const oauthID = hash.digest('hex');

    await createNewUser(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        config,
        userRepository,
        accountRepository,
        affiliationGroupService,
        {
            oauthID,
            provider: Providers.GOOGLE,
            email: email,
            username: username,
            picture: 'https://example.com/picture.jpg',
        },
    );

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (role) {
        const user = await userRepository.findOneOrFail({
            where: { email: email },
        });

        user.role = role;
        await userRepository.save(user);
    }

    const user = await userRepository.findOneOrFail({
        where: { email: email },
    });
    return user.uuid;
};

export const getJwtToken = (user: UserEntity): string => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error(
            'JWT_SECRET is not defined in the environment variables.',
        );
    }
    return jwt.sign({ uuid: user.uuid }, jwtSecret);
};

export const getUserFromDatabase = async (uuid: string) => {
    const userRepository = database.getRepository(UserEntity);
    return await userRepository.findOneOrFail({
        where: { uuid: uuid },
    });
};
