import environment from '@backend-common/environment';
import { ALL_ENTITIES } from '@backend-common/index';

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
    entities: unknown;
    database: DatabaseConfig;
}

const typeormConfig = (): TypeormConfig => ({
    server: {
        port: environment.SERVER_PORT || 3000,
    },
    entities: ALL_ENTITIES,
    database: {
        host: environment.DB_HOST,
        port: environment.DB_PORT,
        username: environment.DB_USER,
        password: environment.DB_PASSWORD,
        database: environment.DB_DATABASE,
    },
});
export default typeormConfig;
