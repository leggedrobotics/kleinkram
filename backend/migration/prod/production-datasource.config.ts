import dotenv from 'dotenv';
import * as process from 'node:process';
import { DataSourceOptions } from 'typeorm';

dotenv.config({ path: './migration/.env' });

const databasePort = process.env['prod_port'];

export function getConfig() {
    return {
        type: 'postgres',
        host: process.env['prod_dbhost'],
        port: Number.parseInt(databasePort ?? '5432', 10),
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
