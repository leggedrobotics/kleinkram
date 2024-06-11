import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

export function getConfig() {
    return {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: process.env.local_dbpassword,
        database: 'dbname',
        synchronize: false,
        migrations: ['migration/local/migrations/*.ts'],
        entities: ['src/**/*.entity{.ts,.js}'],
    } as DataSourceOptions;
}
