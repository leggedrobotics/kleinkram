import {
    ActionTemplateEntity,
    ActionTriggerEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights, TriggerType } from '@kleinkram/shared';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../auth/utilities';
import {
    createActionUsingPost,
    createMissionUsingPost,
    createProjectUsingPost,
    HeaderCreator,
} from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

/**
 * Action template and trigger names follow the naming rules of projects and
 * missions (`packages/validation/src/name.validation.ts`) when they are new or
 * changed. Names from before the rules are kept when a template gets a new
 * version or a trigger is edited without renaming it.
 */
describe('Action template and trigger names', () => {
    setupDatabaseHooks();

    let user: UserEntity;
    let missionUuid: string;
    let templateUuid: string;

    const templateFields = {
        description: 'desc',
        accessRights: AccessGroupRights.READ,
        dockerImage: 'hello-world',
        maxRuntime: 10,
        cpuCores: 1,
        cpuMemory: 2,
        gpuMemory: 0,
    };

    const send = async (
        method: 'POST' | 'PATCH',
        path: string,
        body: Record<string, unknown>,
    ): Promise<{ status: number; message: string }> => {
        const headersBuilder = new HeaderCreator(user);
        headersBuilder.addHeader('Content-Type', 'application/json');
        const response = await fetch(`${DEFAULT_URL}${path}`, {
            method,
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify(body),
        });
        const json = (await response.json()) as {
            message?: string | string[];
        };
        const message = Array.isArray(json.message)
            ? json.message.join('; ')
            : (json.message ?? '');
        return { status: response.status, message };
    };

    beforeEach(async () => {
        const setup = await generateAndFetchDatabaseUser('internal', 'admin');
        user = setup.user;
        const projectUuid = await createProjectUsingPost(
            {
                name: 'naming_project',
                description: 'desc',
                requiredMetadataTypes: [],
                accessGroups: [],
            },
            user,
        );
        missionUuid = await createMissionUsingPost(
            {
                name: 'naming_mission',
                projectUUID: projectUuid,
                metadata: {},
                ignoreMissingMetadata: true,
            },
            user,
        );
        templateUuid = await createActionUsingPost(
            { name: 'naming-template', ...templateFields },
            user,
        );
    });

    const timeTrigger = (name: string): Record<string, unknown> => ({
        name,
        description: 'desc',
        type: TriggerType.TIME,
        missionUuid,
        templateUuid,
        config: { cron: '0 0 * * *' },
    });

    it('refuses a new template with an invalid name and suggests one', async () => {
        const response = await send('POST', '/templates', {
            name: 'Lidar Validation',
            ...templateFields,
        });
        expect(response.status).toBe(400);
        expect(response.message).toBe(
            "Template name may only contain letters, digits, '.', '-' and '_' (found space). Try \"Lidar-Validation\".",
        );
    });

    it('adds a version to a template named before the rules', async () => {
        await database
            .getRepository(ActionTemplateEntity)
            .update({ uuid: templateUuid }, { name: 'Legacy Template' });

        const response = await send(
            'POST',
            `/templates/${templateUuid}/versions`,
            { uuid: templateUuid, name: 'Legacy Template', ...templateFields },
        );
        expect(response.status).toBe(201);
    });

    it('refuses a version with another name', async () => {
        const response = await send(
            'POST',
            `/templates/${templateUuid}/versions`,
            { uuid: templateUuid, name: 'Brand New Name', ...templateFields },
        );
        expect(response.status).toBe(400);
        expect(response.message).toBe(
            'A new version cannot change the template name.',
        );
    });

    it('refuses a new trigger with an invalid name', async () => {
        const response = await send(
            'POST',
            '/triggers',
            timeTrigger('Nightly Build'),
        );
        expect(response.status).toBe(400);
        expect(response.message).toBe(
            "Trigger name may only contain letters, digits, '.', '-' and '_' (found space). Try \"Nightly-Build\".",
        );
        const valid = await send(
            'POST',
            '/triggers',
            timeTrigger('nightly-build'),
        );
        expect(valid.status).toBe(201);
    });

    it('keeps an unchanged trigger name from before the rules, checks a changed one', async () => {
        const created = await send(
            'POST',
            '/triggers',
            timeTrigger('legacy-trigger'),
        );
        expect(created.status).toBe(201);
        const trigger = await database
            .getRepository(ActionTriggerEntity)
            .findOneByOrFail({ name: 'legacy-trigger' });
        await database
            .getRepository(ActionTriggerEntity)
            .update({ uuid: trigger.uuid }, { name: 'Legacy Trigger' });

        const unchanged = await send('PATCH', `/triggers/${trigger.uuid}`, {
            name: 'Legacy Trigger',
            description: 'new description',
        });
        expect(unchanged.status).toBe(200);

        const renamedInvalid = await send(
            'PATCH',
            `/triggers/${trigger.uuid}`,
            { name: 'Other Name' },
        );
        expect(renamedInvalid.status).toBe(400);
        expect(renamedInvalid.message).toContain(
            'Trigger name may only contain',
        );

        const renamedValid = await send('PATCH', `/triggers/${trigger.uuid}`, {
            name: 'other-name',
        });
        expect(renamedValid.status).toBe(200);
    });
});
