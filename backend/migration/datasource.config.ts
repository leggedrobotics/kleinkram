import { DataSourceOptions } from 'typeorm';
import dotenv from 'dotenv';
import * as process from 'node:process';

dotenv.config();

export function getConfig() {
    return {
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'dbuser',
        password: 'dbuserpass',
        database: 'dbname',
        synchronize: false,
        migrations: ['migrations/*.ts'],
        entities: [__dirname + '/../**/entity/*.entity.{ts,js}'],
    } as DataSourceOptions;
}
