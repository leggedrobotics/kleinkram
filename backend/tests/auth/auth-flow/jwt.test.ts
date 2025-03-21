import { clearAllData, db as database } from '../../utils/database_utils';
import process from 'node:process';

describe('Verify JWT Handling', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    beforeEach(clearAllData);
    afterAll(async () => {
        await database.destroy();
    });

    test('reject allow self-signed JWT token', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ user: '' }, 'this-is-not-the-server-secret');

        const res = await fetch(`http://localhost:3000/project`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,
            },
            body: JSON.stringify({
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });

        expect(res.status).toBe(401);
    });

    test('reject corrupted (empty) JWT token', async () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { user: { uuid: '' } },
            process.env['JWT_SECRET'],
        );

        const res = await fetch(`http://localhost:3000/project`, {
            method: 'POST',
            headers: {
                cookie: `authtoken=${token}`,
            },
            body: JSON.stringify({
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });
        expect(res.status).toBe(401);
    });
});
