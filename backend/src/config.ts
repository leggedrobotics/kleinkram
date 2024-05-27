import Env from './env';

type DatabaseConfig = {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
};

type ServerConfig = {
    port: number | undefined;
};

type Config = {
    server: ServerConfig;
    entities: string;
    database: DatabaseConfig;
};

export default (): Config => ({
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
