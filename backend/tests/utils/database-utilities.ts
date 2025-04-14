import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Account from '@common/entities/auth/account.entity';
import GroupMembership from '@common/entities/auth/group-membership.entity';
import User from '@common/entities/user/user.entity';
import { Providers, UserRole } from '@common/frontend_shared/enum';
import jwt from 'jsonwebtoken';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import process from 'node:process';
import { DataSource } from 'typeorm';
import {
    createAccessGroups,
    createNewUser,
} from '../../src/services/auth.service';

const databasePort = process.env['DB_PORT'];

export const database = new DataSource({
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
        const entities = database.entityMetadatas;

        // filter out the tables that should not be cleared (e.g. views)
        const tablesToClear = entities
            .filter((entity) => entity.tableName !== undefined)
            .filter((entity) => !entity.tableName.includes('view'))
            .filter((entity) => !entity.tableName.includes('materialized'))
            .filter((entity) => !entity.tableName.includes('worker'))
            .map((entity) => `"${entity.tableName}"`)
            .join(', ');

        await database.query(`TRUNCATE ${tablesToClear} CASCADE;`);
    } catch (error: any) {
        throw new Error(`ERROR: Cleaning test database: ${error.toString()}`);
    }
};

export const mockDatabaseUser = async (
    email: string,
    username = 'Test User',
    role: UserRole = UserRole.USER,
): Promise<string> => {
    // read config from access_config.json
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const config = JSON.parse(fs.readFileSync('access_config.json', 'utf8'));
    const accessGroupRepository = database.getRepository(AccessGroup);
    const groupMembershipRepository = database.getRepository(GroupMembership);
    await createAccessGroups(accessGroupRepository, config);

    const userRepository = database.getRepository(User);
    const accountRepository = database.getRepository(Account);

    // hash the email to create a unique oauthID
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

    const user = await userRepository.findOneOrFail({
        where: { email: email },
    });
    return user.uuid;
};

export const getJwtToken = (user: User): string => {
    const jwtSecret = process.env['JWT_SECRET'];
    if (!jwtSecret) {
        throw new Error(
            'JWT_SECRET is not defined in the environment variables.',
        );
    }
    return jwt.sign({ uuid: user.uuid }, jwtSecret);
};

export const getUserFromDatabase = async (uuid: string) => {
    const userRepository = database.getRepository(User);
    return await userRepository.findOneOrFail({
        where: { uuid: uuid },
    });
};
