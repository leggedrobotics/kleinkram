import { S3Client } from '@aws-sdk/client-s3';
import environment from '@backend-common/environment';

export interface S3ClientContainer {
    external: S3Client;
    internal: S3Client;
}

export const S3ClientFactory = {
    provide: 'S3_CLIENTS',
    useFactory: (): S3ClientContainer => {
        const credentials = {
            accessKeyId: environment.S3_ACCESS_KEY,
            secretAccessKey: environment.S3_SECRET_KEY,
        };

        let externalEndpoint = environment.S3_ENDPOINT;
        if (
            !externalEndpoint.startsWith('http://') &&
            !externalEndpoint.startsWith('https://')
        ) {
            const externalProtocol = environment.DEV ? 'http' : 'https';
            const externalPort = environment.DEV ? ':9000' : '';
            externalEndpoint = `${externalProtocol}://${environment.S3_ENDPOINT}${externalPort}`;
        }

        return {
            external: new S3Client({
                endpoint: externalEndpoint,
                credentials,
                region: 'us-east-1',
                forcePathStyle: true,
            }),
            internal: new S3Client({
                endpoint: 'http://seaweedfs:9000',
                credentials,
                region: 'us-east-1',
                forcePathStyle: true,
            }),
        };
    },
};
