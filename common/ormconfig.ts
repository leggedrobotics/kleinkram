import process from 'node:process';

module.exports = {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    ssl: process.env.DB_SSL === 'true',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    entities: [
        'entities/**/*.entity{.ts,.js}',
        'viewEntities/**/*.entity{.ts,.js}',
    ],
    seeds: ['seeds/**/*.seed{.ts,.js}'],
    factories: ['factories/**/*.factory{.ts,.js}'],
};
