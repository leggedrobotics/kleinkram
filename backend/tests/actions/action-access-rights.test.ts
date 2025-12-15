import { CreateTemplateDto } from '@kleinkram/api-dto/types/actions/create-template.dto';
import { SubmitActionDto } from '@kleinkram/api-dto/types/submit-action-response.dto';
import { AccessGroupRights } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { clearAllData, database } from '../utils/database-utilities';

describe('Action Access Rights', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();
    });

    afterAll(async () => {
        await database.destroy();
    });

    test('if a user can only start an action if they have sufficient rights', async () => {
        // 1. Create a user (creator)
        const { user: creator } = await generateAndFetchDatabaseUser(
            'internal',
            'user',
        );

        // 2. Create a project and mission
        const projectUUID = await createProjectUsingPost(
            {
                name: 'access_rights_project',
                description: 'Test project for access rights',
            },
            creator,
        );
        expect(projectUUID).toBeDefined();

        const missionUUID = await createMissionUsingPost(
            {
                name: 'access_rights_mission',
                projectUUID: projectUUID,
                tags: {},
                ignoreTags: false,
            },
            creator,
        );
        expect(missionUUID).toBeDefined();

        // 3. Create another user (limitedUser)
        const { user: limitedUser } = await generateAndFetchDatabaseUser(
            'external',
            'user',
        );

        // 4. Create Action Template requiring WRITE rights
        const writeHeaders = new HeaderCreator(creator);
        writeHeaders.addHeader('Content-Type', 'application/json');
        const writeTemplateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: writeHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'write_access_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 512,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.WRITE,
            } as CreateTemplateDto),
        });
        if (writeTemplateResponse.status !== 201) {
            console.log(
                '[DEBUG] Template creation error:',
                await writeTemplateResponse.text(),
            );
        }
        expect(writeTemplateResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { uuid: writeTemplateUUID } = await writeTemplateResponse.json();

        // 5. Create Action Template requiring READ rights
        const readHeaders = new HeaderCreator(creator);
        readHeaders.addHeader('Content-Type', 'application/json');
        const readTemplateResponse = await fetch(`${DEFAULT_URL}/templates`, {
            method: 'POST',
            headers: readHeaders.getHeaders(),
            body: JSON.stringify({
                name: 'read_access_template',
                description: 'Test template',
                dockerImage: 'hello-world',
                cpuCores: 1,
                cpuMemory: 512,
                gpuMemory: 0,
                maxRuntime: 60,
                accessRights: AccessGroupRights.READ,
            } as CreateTemplateDto),
        });
        expect(readTemplateResponse.status).toBe(201);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const { uuid: readTemplateUUID } = await readTemplateResponse.json();

        // 6. Try to submit WRITE action as limitedUser (should fail 403)
        const limitedHeaders = new HeaderCreator(limitedUser);
        limitedHeaders.addHeader('Content-Type', 'application/json');
        const failResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: limitedHeaders.getHeaders(),
            body: JSON.stringify({
                missionUUID: missionUUID,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                templateUUID: writeTemplateUUID,
            } as SubmitActionDto),
        });
        expect(failResponse.status).toBe(403);

        // 7. Try to submit READ action as limitedUser (should also fail 403 if they have NO rights)
        const failReadResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: limitedHeaders.getHeaders(),
            body: JSON.stringify({
                missionUUID: missionUUID,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                templateUUID: readTemplateUUID,
            } as SubmitActionDto),
        });
        expect(failReadResponse.status).toBe(403);
    });
});
