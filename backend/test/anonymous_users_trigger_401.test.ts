import * as assert from "node:assert";
import {get_endpoints} from "./utils/endpoints";

const unauthorized_endpoints = [
    '/file/downloadWithToken', // anonymous users can download files using a valid token
    '/auth/google', // anonymous users can login
    '/auth/google/callback', // anonymous users can login
    '/auth/logout' // anonymous users can logout
];

const endpoints = get_endpoints();
for (const endpoint of endpoints) {

    if (unauthorized_endpoints.includes(endpoint.url)) continue;

    test(`test if unauthorized ${endpoint.method} to endpoint ${endpoint.url} returns 401`, async () => {
        const res = await fetch(`http://localhost:3000${endpoint.url}`, {
            method: endpoint.method,
        });
        assert.equal(res.status, 401,
            `endpoint ${endpoint.method} ${endpoint.url} does not return 401`);
    });

}
