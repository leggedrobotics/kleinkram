import process from 'node:process';

export default {
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
    ssl: process.env.DB_SSL === 'true',
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false,
    entities: [
        'src/entities/**/*.entity{.ts,.js}',
        'src/viewEntities/**/*.entity{.ts,.js}',
    ],
    seeds: ['src/seeds/**/*.seed{.ts,.js}'],
    factories: ['src/factories/**/*.factory{.ts,.js}'],
};
