import jwt from 'jsonwebtoken';
import process from 'node:process';
import { HeaderCreator } from '../../utils/api-calls';
import { clearAllData, database } from '../../utils/database-utilities';

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
        const token = jwt.sign({ user: '' }, 'this-is-not-the-server-secret');

        const headersBuilder = new HeaderCreator();
        headersBuilder.addHeader('Content-Type', 'application/json');
        headersBuilder.addHeader('cookie', `authtoken=${token}`);

        const response = await fetch(`http://localhost:3000/project`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });

        expect(response.status).toBe(401);
    });

    test('reject corrupted (empty) JWT token', async () => {
        // Use the already imported jwt module
        const token = jwt.sign(
            { user: { uuid: '' } },
            process.env['JWT_SECRET'] || 'default-secret',
        );

        const headersBuilder = new HeaderCreator();
        headersBuilder.addHeader('Content-Type', 'application/json');
        headersBuilder.addHeader('cookie', `authtoken=${token}`);

        const response = await fetch(`http://localhost:3000/project`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                name: 'test_project',
                description: 'This is a test project',
                requiredTags: [],
            }),
        });
        expect(response.status).toBe(401);
    });
});
