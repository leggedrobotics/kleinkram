import environment from '@backend-common/environment';
import { Client } from 'minio';

export interface S3ClientContainer {
    external: Client;
    internal: Client;
}

export const S3ClientFactory = {
    provide: 'S3_CLIENTS',
    useFactory: (): S3ClientContainer => {
        const baseConfig = {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            endPoint: environment.S3_ENDPOINT ?? 'seaweedfs',
            accessKey: environment.S3_ACCESS_KEY,
            secretKey: environment.S3_SECRET_KEY,
            region: 'just-a-placeholder', // not used but required by the lib
        };

        return {
            external: new Client({
                ...baseConfig,
                endPoint: environment.S3_ENDPOINT,
                useSSL: !environment.DEV,
                port: environment.DEV ? 9000 : 443,
            }),
            internal: new Client({
                ...baseConfig,
                endPoint: 'seaweedfs', // internal network address
                useSSL: false,
                port: 9000,
            }),
        };
    },
};
