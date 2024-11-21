import Env from './env';

interface DatabaseConfig {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
}

interface ServerConfig {
    port: number | undefined;
}

interface TypeormConfig {
    server: ServerConfig;
    entities: string;
    database: DatabaseConfig;
}

export default (): TypeormConfig => ({
    server: {
        port: Env.SERVER_PORT || 3000,
    },
    entities: Env.ENTITIES,
    database: {
        host: Env.DB_HOST,
        port: Env.DB_PORT,
        username: Env.DB_USER,
        password: Env.DB_PASSWORD,
        database: Env.DB_DATABASE,
    },
});
