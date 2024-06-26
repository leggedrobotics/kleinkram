import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

export function getConfig() {
    return {
        type: 'postgres',
        host: process.env.dev_dbhost,
        port: parseInt(process.env.dev_port, 10),
        ssl: process.env.dev_ssl === 'true',
        username: process.env.dev_dbuser,
        password: process.env.dev_dbpassword,
        database: process.env.dev_dbname,
        synchronize: false,
        migrations: ['migration/dev/migrations/*.ts'],
        entities: ['../common/entities/**/*.entity{.ts,.js}'],
    } as DataSourceOptions;
}
