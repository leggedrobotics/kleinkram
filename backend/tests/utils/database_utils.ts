import {DataSource} from "typeorm";
import process from "node:process";
import AccessGroup from "@common/entities/auth/accessgroup.entity";
import {create_access_groups, create_new_user} from "../../src/auth/auth.service";
import User from "@common/entities/user/user.entity";
import Account from "@common/entities/auth/account.entity";
import {Providers, UserRole} from "@common/enum";

export const appDataSource = new DataSource({
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
        const entities = appDataSource.entityMetadatas;
        const tableNames = entities.map((entity) => `"${entity.tableName}"`).join(", ");

        // filter out the tables that should not be cleared (e.g. views)
        const tablesToClear = entities
            .filter((entity) => entity.tableName !== undefined)
            .filter((entity) => !entity.tableName.includes('view'))
            .map((entity) => `"${entity.tableName}"`).join(", ");

        await appDataSource.query(`TRUNCATE ${tablesToClear} CASCADE;`);
    } catch (error) {
        throw new Error(`ERROR: Cleaning test database: ${error}`);
    }
}

export const mock_db_user = async (username: string, email: string, role: UserRole = undefined) => {

    // read config from access_config.json
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('access_config.json', 'utf8'));
    const accessGroupRepository = appDataSource.getRepository(AccessGroup);
    await create_access_groups(accessGroupRepository, config);

    const userRepository = appDataSource.getRepository(User);
    const accountRepository = appDataSource.getRepository(Account);

    await create_new_user(config, userRepository, accountRepository, accessGroupRepository, {
        oauthID: '123',
        provider: Providers.GOOGLE,
        email: email,
        username: username,
        picture: 'https://example.com/picture.jpg',
    });

    if (role) {
        const user = await userRepository.findOne({where: {email: email}});
        user.role = role;
        await userRepository.save(user);
    }

}

export const get_jwt_token = async (user: User) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({user: user.uuid}, process.env.JWT_SECRET);
}
