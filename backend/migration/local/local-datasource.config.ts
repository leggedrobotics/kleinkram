import dotenv from 'dotenv';
import * as process from 'node:process';
import { DataSourceOptions } from 'typeorm';

dotenv.config({ path: './migration/.env' });

const databasePort = process.env['local_dbport'];

export function getConfig() {
    return {
        type: 'postgres',
        host: process.env['local_dbhost'],
        port: Number.parseInt(databasePort ?? '5432', 10),
        ssl: process.env['local_ssl'] === 'true',
        username: process.env['local_dbuser'],
        password: process.env['local_dbpassword'],
        database: process.env['local_dbname'],
        synchronize: false,
        migrations: ['migration/local/migrations/*.ts'],
        entities: [
            '../common/entities/**/*.entity{.ts,.js}',
            '../common/viewEntities/**/*.entity{.ts,.js}',
        ],
    } as DataSourceOptions;
}
