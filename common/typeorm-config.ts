import Environment from './environment';

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

const typeormConfig = (): TypeormConfig => ({
    server: {
        port: Environment.SERVER_PORT || 3000,
    },
    entities: Environment.ENTITIES,
    database: {
        host: Environment.DB_HOST,
        port: Environment.DB_PORT,
        username: Environment.DB_USER,
        password: Environment.DB_PASSWORD,
        database: Environment.DB_DATABASE,
    },
});
export default typeormConfig;
