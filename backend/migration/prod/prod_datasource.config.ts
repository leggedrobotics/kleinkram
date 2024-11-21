import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

const dbPort = process.env['prod_port'];

export function getConfig() {
    return {
        type: 'postgres',
        host: process.env['prod_dbhost'],
        port: parseInt(dbPort ?? '5432', 10),
        ssl: process.env['prod_ssl'] === 'true',
        username: process.env['prod_dbuser'],
        password: process.env['prod_dbpassword'],
        database: process.env['prod_dbname'],
        synchronize: false,
        migrations: ['migration/prod/migrations/*.ts'],
        entities: [
            '../common/entities/**/*.entity{.ts,.js}',
            '../common/viewEntities/**/*.entity{.ts,.js}',
        ],
    } as DataSourceOptions;
}
