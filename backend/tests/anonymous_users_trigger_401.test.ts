import * as assert from 'node:assert';
import { get_endpoints } from './utils/endpoints';

describe('Anonymous users trigger 401', () => {
    const unauthorized_endpoints = [
        '/auth/google',
        '/auth/google/callback',
        '/auth/logout',
        '/metrics',
    ];

    const endpoints = get_endpoints();
    for (const endpoint of endpoints) {
        if (unauthorized_endpoints.includes(endpoint.url)) continue;

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
