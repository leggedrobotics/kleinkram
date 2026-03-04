import * as assert from 'node:assert';
import { HeaderCreator } from '../utils/api-calls';
import { getEndpoints } from '../utils/endpoints';

const UNAUTHENTICATED_ENDPOINTS: string[] = [
    '/auth/google',
    '/auth/google/callback',
    '/auth/github',
    '/auth/github/callback',
    '/auth/fake-oauth',
    '/auth/fake-oauth/callback',
    '/auth/available-providers',
    '/auth/logout',
    '/metrics',
    '/swagger',
    '/swagger/',
    '/integrations/',
    '/api/health',
    '/hooks/actions/',
];

/**
 *
 * This test suite tests if an unauthenticated users trigger 401 when
 * trying to access protected endpoints. By default, all endpoints
 * should be protected and must require authentication.
 *
 * This test set is used as a baseline to ensure that the server is
 * correctly configured to reject unauthenticated requests for
 * protected endpoints. This test case does not test the
 * specific behavior of each endpoint or authorization logic.
 *
 */
describe('Unauthenticated users trigger 401', () => {
    const endpoints = getEndpoints();
    for (const endpoint of endpoints) {
        // skip endpoints that are not protected
        if (
            // eslint-disable-next-line @typescript-eslint/naming-convention
            UNAUTHENTICATED_ENDPOINTS.some((url_prefix: string) =>
                endpoint.url.startsWith(url_prefix),
            )
        )
            continue;

        test(`test if rejects unauthorized request (401): \t${endpoint.method.toUpperCase()}\t ${endpoint.url}`, async () => {
            const headersBuilder = new HeaderCreator();
            headersBuilder.addHeader('Content-Type', 'application/json');
            headersBuilder.addHeader('Connection', 'close');

            // Replace placeholders in URL with dummy values
            const url = endpoint.url
                .replace('{uuid}', '1b671a64-40d5-491e-99b0-da01ff1f3341')
                .replace('{filename}', 'test.txt');

            // Normalize method to uppercase
            const method = endpoint.method.toUpperCase();

            // Provide a dummy body for mutation requests to avoid 400 body-parser errors
            const body = ['POST', 'PATCH', 'PUT'].includes(method)
                ? JSON.stringify({})
                : undefined;

            const response = await fetch(`http://localhost:3000${url}`, {
                method,
                headers: headersBuilder.getHeaders(),
                body,
            });
            assert.equal(
                response.status,
                401,
                `endpoint\t${method}\t${url} does not return 401`,
            );
        });
    }
});
