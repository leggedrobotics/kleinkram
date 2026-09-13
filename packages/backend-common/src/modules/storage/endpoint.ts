import environment from '../../environment';

/**
 * Builds the S3 endpoint url as it is reachable from *outside* the compose
 * network - by the CLI, by action containers and by presigned links.
 *
 * Local development serves SeaweedFS over plain HTTP on port 9000, so the
 * scheme cannot be assumed to be https: talking TLS to it makes clients retry
 * until they time out rather than fail fast.
 */
export const externalS3Endpoint = (): string => {
    let endpoint = environment.S3_ENDPOINT;

    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
        endpoint = `${environment.DEV ? 'http' : 'https'}://${endpoint}`;
    }

    try {
        const url = new URL(endpoint);
        if (environment.DEV && !url.port) {
            url.port = '9000';
        }
        return url.toString().replace(/\/$/, '');
    } catch {
        // Leave malformed values alone; the S3 client reports them better.
        return endpoint;
    }
};
