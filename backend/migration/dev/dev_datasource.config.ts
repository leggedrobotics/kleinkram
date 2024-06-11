import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

export function getConfig() {
    return {
        type: 'postgres',
        host: 'db.datasets.dev.leggedrobotics.com',
        port: 443,
        ssl: true,
        username: 'postgress_user',
        password: process.env.dev_dbpassword,
        database: 'grandtour',
        synchronize: false,
        migrations: ['migration/dev/migrations/*.ts'],
        entities: ['src/**/*.entity{.ts,.js}'],
    } as DataSourceOptions;
}
