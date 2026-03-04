import { ActionTemplateEntity } from '@kleinkram/backend-common/entities/action/action-template.entity';
import { ActionEntity } from '@kleinkram/backend-common/entities/action/action.entity';
import { AccessGroupEntity } from '@kleinkram/backend-common/entities/auth/access-group.entity';
import { AccountEntity } from '@kleinkram/backend-common/entities/auth/account.entity';
import { GroupMembershipEntity } from '@kleinkram/backend-common/entities/auth/group-membership.entity';
import { ProjectAccessEntity } from '@kleinkram/backend-common/entities/auth/project-access.entity';
import { MissionEntity } from '@kleinkram/backend-common/entities/mission/mission.entity';
import { ProjectEntity } from '@kleinkram/backend-common/entities/project/project.entity';
import { UserEntity } from '@kleinkram/backend-common/entities/user/user.entity';
import { WorkerEntity } from '@kleinkram/backend-common/entities/worker/worker.entity';
import { AccessControlService } from '@kleinkram/backend-common/modules/access-control/access-control.service';
import { ActionDispatcherService } from '@kleinkram/backend-common/modules/action-dispatcher/action-dispatcher.service';
import { MissionAccessViewEntity } from '@kleinkram/backend-common/viewEntities/mission-access-view.entity';
import { ProjectAccessViewEntity } from '@kleinkram/backend-common/viewEntities/project-access-view.entity';
import { AccessGroupRights, Providers, UserRole } from '@kleinkram/shared';
import { Gauge } from 'prom-client';
import { EntityTarget, ObjectLiteral } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { database } from '../utils/database-utilities';
import { setupDatabaseHooks } from '../utils/test-helpers';

// Mock Gauge
const mockGauge = {
    set: jest.fn(),
    inc: jest.fn(),
    dec: jest.fn(),
} as unknown as Gauge;

// Repositories
const getRepo = <T extends ObjectLiteral>(target: EntityTarget<T>) =>
    database.getRepository<T>(target);

const createTestUser = async (username = 'testuser'): Promise<UserEntity> => {
    const user = getRepo<UserEntity>(UserEntity).create({
        name: username,
        email: `${username}@test.com`,
        role: UserRole.USER,
    });
    await getRepo(UserEntity).save(user);

    const account = getRepo<AccountEntity>(AccountEntity).create({
        user,
        provider: Providers.GOOGLE,
        oauthID: uuidv4(),
    });
    await getRepo(AccountEntity).save(account);

    const group = getRepo<AccessGroupEntity>(AccessGroupEntity).create({
        name: `Personal Group ${username}`,
    });
    await getRepo(AccessGroupEntity).save(group);

    const membership = getRepo<GroupMembershipEntity>(
        GroupMembershipEntity,
    ).create({
        user,
        accessGroup: group,
    });
    await getRepo(GroupMembershipEntity).save(membership);

    return getRepo<UserEntity>(UserEntity).findOneOrFail({
        where: { uuid: user.uuid },
        relations: ['memberships', 'memberships.accessGroup'],
    });
};

const createTestProject = async (
    owner: UserEntity,
    name = 'Test Project',
): Promise<ProjectEntity> => {
    const project = getRepo<ProjectEntity>(ProjectEntity).create({
        name,
        description: 'Test Project Description',
        requiredTags: [],
        creator: owner,
    });
    await getRepo(ProjectEntity).save(project);

    if (!owner.memberships?.[0]?.accessGroup) {
        throw new Error('Owner has no access group');
    }
    const personalGroup = owner.memberships[0].accessGroup;
    const projectAccess = getRepo<ProjectAccessEntity>(
        ProjectAccessEntity,
    ).create({
        project,
        accessGroup: personalGroup,
        rights: AccessGroupRights.WRITE,
    });
    await getRepo(ProjectAccessEntity).save(projectAccess);
    return project;
};

describe('Trigger Security', () => {
    // Standard basic setup
    setupDatabaseHooks();

    let actionDispatcher: ActionDispatcherService;

    beforeAll(() => {
        // Manually instantiate the service with repositories from the shared connection
        // and mock metrics.
        const accessControlService = new AccessControlService(
            getRepo(MissionEntity),
            getRepo(MissionAccessViewEntity),
            getRepo(ProjectAccessViewEntity),
        );

        actionDispatcher = new ActionDispatcherService(
            getRepo(ActionEntity),
            getRepo(ActionTemplateEntity),
            getRepo(WorkerEntity),
            mockGauge, // backend_online_workers
            mockGauge, // backend_pending_jobs
            mockGauge, // backend_active_jobs
            mockGauge, // backend_completed_jobs
            mockGauge, // backend_failed_jobs
            accessControlService,
        );
    });

    it('should deny trigger execution if creator permission is downgraded from WRITE to READ', async () => {
        const user = await createTestUser('user_downgrade');
        const project = await createTestProject(user);

        const mission = getRepo<MissionEntity>(MissionEntity).create({
            name: 'Mission Downgrade',
            project,
            creator: user,
        });
        await getRepo(MissionEntity).save(mission);

        const template = getRepo<ActionTemplateEntity>(
            ActionTemplateEntity,
        ).create({
            name: `Template Write ${uuidv4()}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: 'ubuntu:latest',
            version: 1,
            creator: user,
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: 0,
            maxRuntime: 1,
            accessRights: AccessGroupRights.WRITE, // Requires WRITE
            description: '',
        });
        await getRepo(ActionTemplateEntity).save(template);

        // 1. Success case (Has WRITE)
        try {
            await actionDispatcher.dispatch(template.uuid, mission, user, {});
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                error.message.includes('Creator no longer has access')
            )
                throw error;
        }

        // 2. Downgrade Access to READ
        if (!user.memberships?.[0]?.accessGroup) {
            throw new Error('User has no access group');
        }
        const personalGroup = user.memberships[0].accessGroup;
        await getRepo(ProjectAccessEntity).update(
            {
                project: { uuid: project.uuid },
                accessGroup: { uuid: personalGroup.uuid },
            },
            { rights: AccessGroupRights.READ },
        );

        // 3. Fail case
        await expect(
            actionDispatcher.dispatch(template.uuid, mission, user, {}),
        ).rejects.toThrow('Creator no longer has access to this mission');
    });

    it('should deny trigger execution if creator is transferred to a group without access', async () => {
        const user = await createTestUser('user_transfer');
        const project = await createTestProject(user);

        const mission = getRepo<MissionEntity>(MissionEntity).create({
            name: 'Mission Transfer',
            project,
            creator: user,
        });
        await getRepo(MissionEntity).save(mission);

        const template = getRepo<ActionTemplateEntity>(
            ActionTemplateEntity,
        ).create({
            name: `Template Transfer ${uuidv4()}`,
            // eslint-disable-next-line @typescript-eslint/naming-convention
            image_name: 'ubuntu:latest',
            version: 1,
            creator: user,
            cpuCores: 1,
            cpuMemory: 1,
            gpuMemory: 0,
            maxRuntime: 1,
            accessRights: AccessGroupRights.READ,
            description: '',
        });
        await getRepo(ActionTemplateEntity).save(template);

        // 1. Success case (In Group A with WRITE)
        try {
            await actionDispatcher.dispatch(template.uuid, mission, user, {});
        } catch (error: unknown) {
            if (
                error instanceof Error &&
                error.message.includes('Creator no longer has access')
            )
                throw error;
        }

        // 2. Transfer: Remove from Group A, Add to Group B (No Access)
        if (!user.memberships?.[0]?.accessGroup) {
            throw new Error('User has no access group');
        }
        const groupA = user.memberships[0].accessGroup;

        // Create Group B with NO access to project
        const groupB = getRepo<AccessGroupEntity>(AccessGroupEntity).create({
            name: 'Group B No Access',
        });
        await getRepo(AccessGroupEntity).save(groupB);

        // Remove from Group A
        await getRepo(GroupMembershipEntity).delete({
            user: { uuid: user.uuid },
            accessGroup: { uuid: groupA.uuid },
        });

        // Add to Group B
        const membershipB = getRepo<GroupMembershipEntity>(
            GroupMembershipEntity,
        ).create({ user, accessGroup: groupB });
        await getRepo(GroupMembershipEntity).save(membershipB);

        // 3. Fail case
        await expect(
            actionDispatcher.dispatch(template.uuid, mission, user, {}),
        ).rejects.toThrow('Creator no longer has access to this mission');
    });
});
