/* eslint-disable unicorn/prefer-module */
import path from 'node:path';
import process from 'node:process';

import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
const isTsNode = !!(process as any)[Symbol.for('ts-node.register.instance')];
const extension = isTsNode ? 'ts' : 'js';

export const dataSourceOptions: DataSourceOptions & SeederOptions = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    ssl: process.env.DB_SSL === 'true',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    entities: [
        path.join(__dirname, 'entities', `**/*.entity.${extension}`),
        path.join(__dirname, 'viewEntities', `**/*.entity.${extension}`),
    ],
    seeds: [path.join(__dirname, 'seeds', `**/*.seed.${extension}`)],
    factories: [path.join(__dirname, 'factories', `**/*.factory.${extension}`)],
};

export default new DataSource(dataSourceOptions as DataSourceOptions);
