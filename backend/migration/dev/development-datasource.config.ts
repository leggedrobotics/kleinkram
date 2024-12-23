import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

const databasePort: string | undefined = process.env['dev_port'];

export function getConfig(): DataSourceOptions {
    return {
        type: 'postgres',
        host: process.env['dev_dbhost'],
        port: Number.parseInt(databasePort ?? '5432', 10),
        ssl: process.env['dev_ssl'] === 'true',
        username: process.env['dev_dbuser'],
        password: process.env['dev_dbpassword'],
        database: process.env['dev_dbname'],
        synchronize: false,
        migrations: ['migration/dev/migrations/*.ts'],
        entities: [
            '../common/entities/**/*.entity{.ts,.js}',
            '../common/viewEntities/**/*.entity{.ts,.js}',
        ],
    } as DataSourceOptions;
}
