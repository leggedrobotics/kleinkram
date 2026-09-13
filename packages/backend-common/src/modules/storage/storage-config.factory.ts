import { S3Client } from '@aws-sdk/client-s3';
import environment from '@backend-common/environment';
import { externalS3Endpoint } from './endpoint';

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

        const externalEndpoint = externalS3Endpoint();

        let internalEndpoint =
            environment.S3_ENDPOINT_INTERNAL ?? 'seaweedfs:9000';
        if (
            !internalEndpoint.startsWith('http://') &&
            !internalEndpoint.startsWith('https://')
        ) {
            internalEndpoint = `http://${internalEndpoint}`;
        }

        try {
            const url = new URL(internalEndpoint);
            if (!url.port) {
                url.port = '9000';
            }
            internalEndpoint = url.toString().replace(/\/$/, '');
        } catch {
            // ignore if invalid URL
        }

        return {
            external: new S3Client({
                endpoint: externalEndpoint,
                credentials,
                region: 'us-east-1',
                forcePathStyle: true,
            }),
            internal: new S3Client({
                endpoint: internalEndpoint,
                credentials,
                region: 'us-east-1',
                forcePathStyle: true,
            }),
        };
    },
};
