import {
    ActionStateHistoryDto,
    ActionDto as ApiActionDto,
} from '@kleinkram/api-dto';
import {
    ActionEntity,
    ActionStateTransitionEntity,
    transitionAction,
    UserEntity,
} from '@kleinkram/backend-common';
import {
    AccessGroupRights,
    ActionFailureOrigin,
    ActionState,
    ActionStateCause,
    TERMINAL_ACTION_STATES,
} from '@kleinkram/shared';
import { DEFAULT_URL } from '../auth/utilities';
import { createActionUsingPost, getAuthHeaders } from '../utils/api-calls';
import { database } from '../utils/database-utilities';
import {
    createMockWorker,
    setupDatabaseHooks,
    setupTestEnvironment,
} from '../utils/test-helpers';

const submitAction = async (
    user: UserEntity,
    missionUuid: string,
): Promise<string> => {
    const templateUuid = await createActionUsingPost(
        {
            name: 'State History Test Action',
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
    await createMockWorker('test-worker-state-history');

    const response = await fetch(`${DEFAULT_URL}/actions`, {
        method: 'POST',
        headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'Content-Type': 'application/json',
            ...getAuthHeaders(user),
        },
        body: JSON.stringify({
            missionUUID: missionUuid,
            templateUUID: templateUuid,
        }),
    });
    expect(response.status).toBe(201);
    return ((await response.json()) as { actionUUID: string }).actionUUID;
};

const getJson = async <T>(user: UserEntity, path: string): Promise<T> => {
    const response = await fetch(`${DEFAULT_URL}${path}`, {
        headers: getAuthHeaders(user),
    });
    expect(response.status).toBe(200);
    return (await response.json()) as T;
};

describe('Action state history', () => {
    setupDatabaseHooks();

    test('records who submitted and who cancelled an action', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'state-history@leggedrobotics.com',
            'History User',
        );
        const actionUuid = await submitAction(user, missionUuid);

        // Scheduling depends on the workers of the test setup; pretend the
        // action is running, as the other cancellation tests do.
        await database
            .getRepository(ActionEntity)
            .update({ uuid: actionUuid }, { state: ActionState.PROCESSING });

        const cancelResponse = await fetch(
            `${DEFAULT_URL}/actions/${actionUuid}/cancel`,
            { method: 'POST', headers: getAuthHeaders(user) },
        );
        expect(cancelResponse.status).toBe(201);

        const history = await getJson<ActionStateHistoryDto>(
            user,
            `/actions/${actionUuid}/state-history`,
        );
        const summary = history.data.map((entry) => [
            entry.state,
            entry.causeCode,
            entry.cause,
            entry.actor?.uuid,
        ]);
        expect(summary.at(0)).toEqual([
            ActionState.PENDING,
            ActionStateCause.SUBMITTED,
            'Submitted by History User',
            user.uuid,
        ]);
        expect(summary.at(-1)).toEqual([
            ActionState.CANCELLED,
            ActionStateCause.CANCELLED_BY_USER,
            'Cancelled by History User',
            user.uuid,
        ]);

        const action = await getJson<ApiActionDto>(
            user,
            `/actions/${actionUuid}`,
        );
        expect(action.stateCauseCode).toBe(ActionStateCause.CANCELLED_BY_USER);
        expect(action.stateCause).toBe('Action cancelled by user');
    }, 30_000);

    test('describes a lost-access failure with the current names', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'state-history-access@leggedrobotics.com',
            'Access User',
        );
        const actionUuid = await submitAction(user, missionUuid);

        await transitionAction(database.manager, actionUuid, {
            state: ActionState.FAILED,
            cause: { code: ActionStateCause.MISSION_ACCESS_LOST },
        });

        const stored = await database
            .getRepository(ActionEntity)
            .findOneByOrFail({ uuid: actionUuid });
        // Losing access is up to the user, not Kleinkram.
        expect(stored.failureOrigin).toBe(ActionFailureOrigin.USER);
        expect(stored.state_cause).not.toContain(user.uuid);

        const action = await getJson<ApiActionDto>(
            user,
            `/actions/${actionUuid}`,
        );
        expect(action.stateCause).toBe(
            'User Access User lost access to mission test_mission',
        );
    }, 30_000);

    test('keeps a recorded verdict and writes no duplicate entries', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'state-history-guard@leggedrobotics.com',
            'Guard User',
        );
        const actionUuid = await submitAction(user, missionUuid);
        const manager = database.manager;

        // the janitor records the time limit first ...
        expect(
            await transitionAction(manager, actionUuid, {
                state: ActionState.FAILED,
                cause: { code: ActionStateCause.TIME_LIMIT_EXCEEDED },
            }),
        ).toBe(true);
        // ... so the exit code the kill produced must not replace it
        expect(
            await transitionAction(manager, actionUuid, {
                state: ActionState.FAILED,
                cause: { code: ActionStateCause.EXIT_SIGTERM },
                unlessIn: TERMINAL_ACTION_STATES,
            }),
        ).toBe(false);
        // and reporting the same verdict twice adds no second entry
        await transitionAction(manager, actionUuid, {
            state: ActionState.FAILED,
            cause: { code: ActionStateCause.TIME_LIMIT_EXCEEDED },
        });

        const transitions = await database
            .getRepository(ActionStateTransitionEntity)
            .find({ where: { actionUuid }, order: { createdAt: 'ASC' } });
        const codes = transitions.map((t) => t.causeCode);
        expect(codes.at(-1)).toBe(ActionStateCause.TIME_LIMIT_EXCEEDED);
        expect(
            codes.filter((c) => c === ActionStateCause.TIME_LIMIT_EXCEEDED),
        ).toHaveLength(1);
        expect(codes).not.toContain(ActionStateCause.EXIT_SIGTERM);

        const stored = await database
            .getRepository(ActionEntity)
            .findOneByOrFail({ uuid: actionUuid });
        expect(stored.state_cause_code).toBe(
            ActionStateCause.TIME_LIMIT_EXCEEDED,
        );
    }, 30_000);

    test('shows the stored text for a cause code this version does not know', async () => {
        const { user, missionUuid } = await setupTestEnvironment(
            'state-history-unknown@leggedrobotics.com',
            'Unknown User',
        );
        const actionUuid = await submitAction(user, missionUuid);

        // as written by a newer queue consumer
        await database.getRepository(ActionEntity).update(
            { uuid: actionUuid },
            {
                state: ActionState.FAILED,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause_code: 'SOMETHING_NEWER',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause: 'Stopped for a reason added later',
            },
        );

        const action = await getJson<ApiActionDto>(
            user,
            `/actions/${actionUuid}`,
        );
        expect(action.stateCauseCode).toBe('SOMETHING_NEWER');
        expect(action.stateCause).toBe('Stopped for a reason added later');
    }, 30_000);
});
