import AccessGroup from '@common/entities/auth/accessgroup.entity';
import Project from '@common/entities/project/project.entity';
import User from '@common/entities/user/user.entity';
import { AccessGroupRights } from '@common/frontend_shared/enum';
import { HeaderCreator } from '../../utils/api-calls';
import { clearAllData, database } from '../../utils/database-utilities';
import { DEFAULT_URL, generateAndFetchDatabaseUser } from '../utilities';

/**
 * This test suite tests the access control of the application.
 *
 */

describe('Verify project user/admin access', () => {
    beforeAll(async () => {
        await database.initialize();
        await clearAllData();

        // global url set in utilities
        console.log(`[DEBUG]: Global url: ${DEFAULT_URL}`);

        // Create internal user
        ({
            user: globalThis.creator as User,
            token: globalThis.creator.token,
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global creator: ${globalThis.creator.name}`);

        // Create internal user
        ({
            user: globalThis.user as User,
            token: globalThis.user.token,
            response: globalThis.user.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        console.log(`[DEBUG]: Global user: ${globalThis.user.name}`);

        // Create external user
        ({
            user: globalThis.externalUser as User,
            token: globalThis.externalUser.token,
            response: globalThis.externalUser.response,
        } = await generateAndFetchDatabaseUser('external', 'user'));
        console.log(
            `[DEBUG]: Global external user: ${globalThis.externalUser.name}`,
        );

        // Create admin user
        ({
            user: globalThis.admin as User,
            token: globalThis.admin.token,
            response: globalThis.admin.response,
        } = await generateAndFetchDatabaseUser('internal', 'admin'));
        console.log(`[DEBUG]: Global admin: ${globalThis.admin.name}`);
    });

    beforeEach(async () => {
        // get access group for creator
        const accessGroupRepository =
            database.getRepository<AccessGroup>('access_group');
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.creator.name },
        });

        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.user.name },
        });

        const accessGroupAdmin = await accessGroupRepository.findOneOrFail({
            where: { name: globalThis.admin.name },
        });

        // generate projects with creator
        const projectRepository = database.getRepository<Project>('Project');
        globalThis.projectUuids = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        creator: { uuid: globalThis.creator.uuid },
                        name: `test_project${index + 1}`,
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,
                        project_accesses: [
                            {
                                accessGroup: accessGroupCreator,
                                rights: AccessGroupRights.DELETE,
                            },
                            {
                                accessGroup: accessGroupAdmin,
                                rights: AccessGroupRights.DELETE,
                            },
                            {
                                accessGroup: accessGroupUser,
                                rights: AccessGroupRights.READ,
                            },
                        ],
                    }),
                );
                return project['uuid'];
            }),
        );
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);
    });

    afterEach(async () => {
        // check if users are still in the database
        const userRepository = database.getRepository<User>('User');
        const users = await userRepository.find();
        expect(users.length).toBe(4);

        // Ensure only the four users created in beforeAll are present
        const expectedUserUuids = [
            globalThis.creator.uuid,
            globalThis.user.uuid,
            globalThis.externalUser.uuid,
            globalThis.admin.uuid,
        ];
        const actualUserUuids = users.map((user) => user.uuid);
        expect(actualUserUuids.sort()).toEqual(expectedUserUuids.sort());

        // delete all missions
        const missionRepository = database.getRepository('Mission');
        const allMissions = await missionRepository.find();
        await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        console.log(`[DEBUG]: All Missions removed from database.`);

        // delete project
        const projectRepository = database.getRepository<Project>('Project');
        const allProjects = await projectRepository.find();
        await projectRepository.remove(allProjects);
        const remainingProjects = await projectRepository.find();
        expect(remainingProjects.length).toBe(0);
        console.log(`[DEBUG]: All Projects removed from database.`);
    });

    afterAll(async () => {
        await clearAllData();
        await database.destroy();
    });

    // admin
    test('if user with admin role can view any project', async () => {
        // get projects with admin
        const headerCreator = new HeaderCreator(globalThis.admin);

        for (const [index, uuid] of globalThis.projectUuids.entries()) {
            // Check read accesss
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            });

            expect(response.status).toBe(200);
            const json = await response.json();
            expect(json['name']).toBe(`test_project${index + 1}`);
        }
    });

    test('if user with admin role can edit any project', async () => {
        const headerCreator = new HeaderCreator(globalThis.admin);
        headerCreator.addHeader('Content-Type', 'application/json');

        for (const [index, uuid] of globalThis.projectUuids.entries()) {
            // Check read access
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    name: `newName${index}`,
                    description: `description${index}`,
                    autoConvert: false,
                }),
            });

            expect(response.status).toBe(200);
            const json = await response.json();
            expect(json['name']).toBe(`newName${index}`);
        }
    });

    test('if user with admin role can delete any project', async () => {
        const adminHeader = new HeaderCreator(globalThis.admin);
        adminHeader.addHeader('Content-Type', 'application/json');

        for (const [, uuid] of globalThis.projectUuids.entries()) {
            // Check delete access
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'DELETE',
                headers: adminHeader.getHeaders(),
            });
            expect(response.status).toBe(200);
        }
        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if user with admin role can delete any mission', async () => {
        const missionRepository = database.getRepository('Mission');
        const projectRepository = database.getRepository<Project>('Project');
        const headerCreator = new HeaderCreator(globalThis.admin);
        headerCreator.addHeader('Content-Type', 'application/json');

        const missions = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const project = await projectRepository.findOneOrFail({
                    where: { uuid: globalThis.projectUuids[index] },
                });

                const mission = await missionRepository.save(
                    missionRepository.create({
                        creator: { uuid: globalThis.creator.uuid },
                        name: `test_mission${index + 1}`,
                        project: project,
                        tags: {},
                        ignoreTags: true,
                    }),
                );
                return mission['uuid'];
            }),
        );

        for (const [, uuid] of missions.entries()) {
            // Check delete access
            const response = await fetch(`${DEFAULT_URL}/mission/${uuid}`, {
                method: 'DELETE',
                headers: headerCreator.getHeaders(),
            });
            expect(response.status).toBe(200);
        }
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
    });

    // // external
    test('third party user cannot view any project by default', async () => {
        // try to get all projects with internal user
        const headerInternal = new HeaderCreator(globalThis.user);
        headerInternal.addHeader('Content-Type', 'application/json');

        for (const [, uuid] of globalThis.projectUuids.entries()) {
            // Check read accesss
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'GET',
                headers: headerInternal.getHeaders(),
            });
            expect(response.status).toBe(200);
        }

        // try to get all projects with external user
        const headerExternal = new HeaderCreator(globalThis.externalUser);
        headerExternal.addHeader('Content-Type', 'application/json');

        for (const [, uuid] of globalThis.projectUuids.entries()) {
            // Check read accesss
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'GET',
                headers: headerExternal.getHeaders(),
            });
            expect(response.status).toBe(403);
        }
    });

    test('if external user cannot create a new project', async () => {
        const headersBuilder = new HeaderCreator(globalThis.externalUser);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/project`, {
            method: 'POST',
            headers: headersBuilder.getHeaders(),
            body: JSON.stringify({
                name: 'external_project',
                description: 'Description of external_project',
            }),
            credentials: 'include',
        });

        // check if the request was successful
        expect(response.status).toBe(403);

        const projectRepository = database.getRepository<Project>('Project');
        const projectCount = await projectRepository.count();
        expect(projectCount).toBe(10);
    });

    test('if external user cannot delete any project', async () => {
        const externalHeader = new HeaderCreator(globalThis.externalUser);
        externalHeader.addHeader('Content-Type', 'application/json');
        for (const [, uuid] of globalThis.projectUuids.entries()) {
            // Check delete access
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'DELETE',
                headers: externalHeader.getHeaders(),
            });
            expect(response.status).toBe(403);
        }
        const projectRepository = database.getRepository<Project>('Project');
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);
    });
});
