import * as assert from 'node:assert';
import { getEndpoints } from '../utils/endpoints';

const UNAUTHENTICATED_ENDPOINTS = [
    '/auth/google',
    '/auth/google/callback',
    '/auth/logout',
    '/metrics',
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
        if (UNAUTHENTICATED_ENDPOINTS.includes(endpoint.url)) continue;

        test(`test if rejects unauthorized request (401): \t${endpoint.method.toUpperCase()}\t ${endpoint.url}`, async () => {
            const res = await fetch(`http://localhost:3000${endpoint.url}`, {
                method: endpoint.method,
            });
            assert.equal(
                res.status,
                401,
                `endpoint\t${endpoint.method.toUpperCase()}\t${endpoint.url} does not return 401`,
            );
        });
    }
});
