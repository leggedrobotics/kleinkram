import environment from '@backend-common/environment';
import { Client } from 'minio';

export interface MinioClientContainer {
    external: Client;
    internal: Client;
}

export const MinioClientFactory = {
    provide: 'MINIO_CLIENTS',
    useFactory: (): MinioClientContainer => {
        const baseConfig = {
            endPoint: environment.MINIO_ENDPOINT ?? 'minio',
            accessKey: environment.MINIO_ACCESS_KEY,
            secretKey: environment.MINIO_SECRET_KEY,
            region: 'just-a-placeholder', // not used but required by the lib
        };

        return {
            external: new Client({
                ...baseConfig,
                endPoint: environment.MINIO_ENDPOINT,
                useSSL: !environment.DEV,
                port: environment.DEV ? 9000 : 443,
            }),
            internal: new Client({
                ...baseConfig,
                endPoint: 'minio', // internal network address
                useSSL: false,
                port: 9000,
            }),
        };
    },
};
