import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

export function getConfig() {
    return {
        type: 'postgres',
        host: 'db.datasets.leggedrobotics.com',
        port: 443,
        ssl: true,
        username: 'postgress_user',
        password: process.env.prod_dbpassword,
        database: 'grandtour',
        synchronize: false,
        migrations: ['migration/prod/migrations/*.ts'],
        entities: ['src/**/*.entity{.ts,.js}'],
    } as DataSourceOptions;
}
