import {
    AccessGroupEntity,
    MissionEntity,
    ProjectEntity,
    UserEntity,
} from '@kleinkram/backend-common';
import { AccessGroupRights } from '@kleinkram/shared';
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
            user: globalThis.creator as UserEntity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.creator.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.creator.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
        console.log(`[DEBUG]: Global creator: ${globalThis.creator.name}`);

        // Create internal user
        ({
            user: globalThis.user as UserEntity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.user.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.user.Response,
        } = await generateAndFetchDatabaseUser('internal', 'user'));
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
        console.log(`[DEBUG]: Global user: ${globalThis.user.name}`);

        // Create external user
        ({
            user: globalThis.externalUser as UserEntity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.externalUser.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.externalUser.response,
        } = await generateAndFetchDatabaseUser('external', 'user'));
        console.log(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
            `[DEBUG]: Global external user: ${globalThis.externalUser.name}`,
        );

        // Create admin user
        ({
            user: globalThis.admin as UserEntity,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            token: globalThis.admin.token,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            response: globalThis.admin.response,
        } = await generateAndFetchDatabaseUser('internal', 'admin'));
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-member-access
        console.log(`[DEBUG]: Global admin: ${globalThis.admin.name}`);
    });

    beforeEach(async () => {
        // get access group for creator
        const accessGroupRepository =
            database.getRepository<AccessGroupEntity>(AccessGroupEntity);
        const accessGroupCreator = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.creator.name },
        });

        const accessGroupUser = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.user.name },
        });

        const accessGroupAdmin = await accessGroupRepository.findOneOrFail({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            where: { name: globalThis.admin.name },
        });

        // generate projects with creator
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        globalThis.projectUuids = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const project = await projectRepository.save(
                    projectRepository.create({
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        creator: { uuid: globalThis.creator.uuid },
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        name: `test_project${index + 1}`,
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        description: `This is a test project ${index + 1}`,
                        autoConvert: false,

                        // eslint-disable-next-line @typescript-eslint/naming-convention
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
                return project.uuid;
            }),
        );
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);
    });

    afterEach(async () => {
        // check if users are still in the database
        const userRepository = database.getRepository<UserEntity>(UserEntity);
        const users = await userRepository.find();
        expect(users.length).toBe(4);

        // Ensure only the four users created in beforeAll are present
        const expectedUserUuids = [
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.creator.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.user.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.externalUser.uuid,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            globalThis.admin.uuid,
        ];
        const actualUserUuids = users.map((user) => user.uuid);
        expect(actualUserUuids.sort()).toEqual(expectedUserUuids.sort());

        // delete all missions
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const allMissions = await missionRepository.find();
        await missionRepository.remove(allMissions);
        const remainingMissions = await missionRepository.find();
        expect(remainingMissions.length).toBe(0);
        console.log(`[DEBUG]: All Missions removed from database.`);

        // delete project
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headerCreator = new HeaderCreator(globalThis.admin);

        for (const [index, uuid] of globalThis.projectUuids.entries()) {
            // Check read accesss
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'GET',
                headers: headerCreator.getHeaders(),
            });

            expect(response.status).toBe(200);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const json = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
            expect(json.name).toBe(`test_project${index + 1}`);
        }
    });

    test('if user with admin role can edit any project', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headerCreator = new HeaderCreator(globalThis.admin);
        headerCreator.addHeader('Content-Type', 'application/json');

        for (const [index, uuid] of globalThis.projectUuids.entries()) {
            // Check read access
            const response = await fetch(`${DEFAULT_URL}/projects/${uuid}`, {
                method: 'PUT',
                headers: headerCreator.getHeaders(),
                body: JSON.stringify({
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    name: `newName${index}`,
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                    description: `description${index}`,
                    autoConvert: false,
                }),
            });

            expect(response.status).toBe(200);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const json = await response.json();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions
            expect(json.name).toBe(`newName${index}`);
        }
    });

    test('if user with admin role can delete any project', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(0);
    });

    test('if user with admin role can delete any mission', async () => {
        const missionRepository =
            database.getRepository<MissionEntity>(MissionEntity);
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headerCreator = new HeaderCreator(globalThis.admin);
        headerCreator.addHeader('Content-Type', 'application/json');

        const missions = await Promise.all(
            Array.from({ length: 10 }, async (_, index) => {
                const project = await projectRepository.findOneOrFail({
                    where: { uuid: globalThis.projectUuids[index] },
                });

                const mission = await missionRepository.save(
                    missionRepository.create({
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                        creator: { uuid: globalThis.creator.uuid },
                        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                        name: `test_mission${index + 1}`,
                        project: project,
                    }),
                );
                return mission.uuid;
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const headersBuilder = new HeaderCreator(globalThis.externalUser);
        headersBuilder.addHeader('Content-Type', 'application/json');

        const response = await fetch(`${DEFAULT_URL}/projects`, {
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

        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const projectCount = await projectRepository.count();
        expect(projectCount).toBe(10);
    });

    test('if external user cannot delete any project', async () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
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
        const projectRepository =
            database.getRepository<ProjectEntity>(ProjectEntity);
        const projects = await projectRepository.find();
        expect(projects.length).toBe(10);
    });
});
