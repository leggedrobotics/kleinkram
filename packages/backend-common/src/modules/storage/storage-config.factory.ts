import { S3Client } from '@aws-sdk/client-s3';
import environment from '@backend-common/environment';

/**
 * Upper bound for S3 calls that only touch object metadata (delete, head,
 * tagging, list, bucket configuration). Their duration does not depend on the
 * object size, so a call that takes this long means the storage is stalled.
 *
 * Deliberately not set on the clients themselves: GetObject/PutObject move
 * multi-GB bodies and must stay unbounded. The SDK's `requestTimeout` runs
 * until the response headers arrive (after the whole upload), and
 * `socketTimeout` fires when a slow consumer pauses a download stream.
 */
export const S3_METADATA_TIMEOUT_MS = 30_000;

/** Options for `client.send()` on metadata-only S3 commands. */
export const metadataRequestOptions = (): { abortSignal: AbortSignal } => ({
    abortSignal: AbortSignal.timeout(S3_METADATA_TIMEOUT_MS),
});

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
            externalEndpoint = `${externalProtocol}://${environment.S3_ENDPOINT}`;
        }

        try {
            const url = new URL(externalEndpoint);
            if (environment.DEV && !url.port) {
                url.port = '9000';
            }
            // Remove trailing slash to be safe
            externalEndpoint = url.toString().replace(/\/$/, '');
        } catch {
            // ignore if invalid URL, S3Client will throw later
        }

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
