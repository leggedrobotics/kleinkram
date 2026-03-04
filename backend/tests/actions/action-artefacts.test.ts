import { ActionDto, SubmitActionDto } from '@kleinkram/api-dto';
import { ActionEntity, environment } from '@kleinkram/backend-common';
import { AccessGroupRights, ArtifactState } from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

describe('Action Artefacts Tests', () => {
    setupDatabaseHooks();

    test('should generate a presigned download URL for action artifacts', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'artefact-user@kleinkram.dev',
            'Artefact User',
        );

        const templateUuid = await createActionUsingPost(
            {
                name: 'Artefact Test Action',
                description: 'desc',
                accessRights: AccessGroupRights.READ,
                dockerImage: 'hello-world',
                maxRuntime: 10,
                cpuCores: 1,
                cpuMemory: 2,
                gpuMemory: 0,
            },
            user,
        );

        // Create Worker to avoid 409 on submission
        await createMockWorker('test-worker-artefact');

        // Submit Action
        const submitResponse = await fetch(`${DEFAULT_URL}/actions`, {
            method: 'POST',
            headers: {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'Content-Type': 'application/json',
                ...getAuthHeaders(user),
            },
            body: JSON.stringify({
                missionUUID: missionUuid,
                templateUUID: templateUuid,
            } as SubmitActionDto),
        });

        expect(submitResponse.status).toBe(201);
        const { actionUUID } = (await submitResponse.json()) as {
            actionUUID: string;
        };

        // Mutate the action to simulate a worker uploading an artifact
        const actionRepo = database.getRepository(ActionEntity);
        const action = await actionRepo.findOneOrFail({
            where: { uuid: actionUUID },
        });

        // This is what the worker sets when it uploads an artifact
        const bucket = environment.S3_ARTIFACTS_BUCKET_NAME;
        action.artifact_path = `s3://${bucket}/${actionUUID}.tar.gz`;
        action.artifact_size = 1024;
        action.artifacts = ArtifactState.UPLOADED;
        await actionRepo.save(action);

        // Fetch action details to see if artifactUrl is generated
        const detailsResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUUID}`,
            {
                method: 'GET',
                headers: getAuthHeaders(user),
            },
        );

        expect(detailsResponse.status).toBe(200);
        const details: ActionDto = (await detailsResponse.json()) as ActionDto;

        // It should intercept the s3:// URL and generate a presigned URL
        expect(details.artifactUrl).not.toBe(action.artifact_path);

        // Let's see if it looks like a URL (http/https and contains the artifact file name or uuid)
        expect(details.artifactUrl).toContain('http');
        expect(details.artifactUrl).toContain(actionUUID);
        expect(details.artifactSize).toBe(1024);
    }, 30_000);
});
