import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config({ path: './migration/.env' });

export function getConfig() {
    console.log(process.env.dbpassword);
    return {
        type: 'postgres',
        host: 'db.datasets.dev.leggedrobotics.com',
        port: 443,
        ssl: true,
        username: 'postgress_user',
        password: process.env.dbpassword,
        database: 'grandtour',
        synchronize: false,
        migrations: ['migration/migrations/*.ts'],
        entities: ['src/**/*.entity{.ts,.js}'],
    } as DataSourceOptions;
}
