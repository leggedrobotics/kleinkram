import { addAccessConstraintsToProjectQuery } from '@/endpoints/auth/auth-helper';
import { ProjectEntity } from '@kleinkram/backend-common';
import { UserRole } from '@kleinkram/shared';
import { createProjectUsingPost } from '../../utils/api-calls';
import {
    database,
    getUserFromDatabase,
    mockDatabaseUser,
} from '../../utils/database-utilities';
import { setupDatabaseHooks } from '../../utils/test-helpers';

/**
 * `addAccessConstraintsToProjectQuery` must add to the query's conditions,
 * not replace them: callers filter first and restrict to readable projects
 * second (e.g. `FileQueryService.checkResourceAccess`).
 */
describe('addAccessConstraintsToProjectQuery', () => {
    setupDatabaseHooks();

    test('keeps a filter added before it', async () => {
        const userUuid = await mockDatabaseUser(
            'access-helper@leggedrobotics.com',
            'Access Helper User',
            UserRole.ADMIN,
        );
        const user = await getUserFromDatabase(userUuid);

        const suffix = String(Date.now());
        const requested = await createProjectUsingPost(
            {
                name: `access_helper_requested_${suffix}`,
                description: 'Test project',
                requiredMetadataTypes: [],
            },
            user,
        );
        await createProjectUsingPost(
            {
                name: `access_helper_other_${suffix}`,
                description: 'Test project',
                requiredMetadataTypes: [],
            },
            user,
        );

        const query = database
            .getRepository(ProjectEntity)
            .createQueryBuilder('project')
            .where('project.uuid IN (:...uuids)', { uuids: [requested] });
        addAccessConstraintsToProjectQuery(query, userUuid);

        const projects = await query.select('project.uuid').getMany();
        expect(projects.map((project) => project.uuid)).toEqual([requested]);
    });
});
