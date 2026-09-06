import { ActionEntity } from '@kleinkram/backend-common';
import {
    ActionState,
    CANCELLABLE_ACTION_STATES,
    isCancellableActionState,
    isTerminalActionState,
    TERMINAL_ACTION_STATES,
} from '@kleinkram/shared';
import { ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeleteActionGuard } from '../../src/endpoints/auth/guards/action.guards';
import { MissionGuardService } from '../../src/endpoints/auth/mission-guard.service';

/**
 * Mimics the state transition performed by the `@OnQueueCompleted` hook of the
 * queue consumer (`markJobAsCompleted`). Bull fires that hook for every job
 * that resolves, including the cancellation paths of the action manager, so it
 * must never overwrite a state that is already final.
 */
const markJobAsCompleted = async (
    actionRepository: Pick<Repository<ActionEntity>, 'findOneOrFail' | 'save'>,
    uuid: string,
): Promise<void> => {
    const action = await actionRepository.findOneOrFail({ where: { uuid } });
    if (isTerminalActionState(action.state)) return;
    action.state = ActionState.DONE;
    await actionRepository.save(action);
};

describe('Action terminal state helpers', () => {
    test('every action state is either terminal or not, and the sets do not overlap', () => {
        for (const state of Object.values(ActionState)) {
            expect(
                isTerminalActionState(state) && isCancellableActionState(state),
            ).toBe(false);
        }
    });

    test('CANCELLED is a terminal state', () => {
        expect(isTerminalActionState(ActionState.CANCELLED)).toBe(true);
        expect(TERMINAL_ACTION_STATES).toContain(ActionState.CANCELLED);
    });

    test('DONE, FAILED and UNPROCESSABLE are terminal states', () => {
        expect(isTerminalActionState(ActionState.DONE)).toBe(true);
        expect(isTerminalActionState(ActionState.FAILED)).toBe(true);
        expect(isTerminalActionState(ActionState.UNPROCESSABLE)).toBe(true);
    });

    test('in-flight states are not terminal', () => {
        expect(isTerminalActionState(ActionState.PENDING)).toBe(false);
        expect(isTerminalActionState(ActionState.STARTING)).toBe(false);
        expect(isTerminalActionState(ActionState.PROCESSING)).toBe(false);
        expect(isTerminalActionState(ActionState.STOPPING)).toBe(false);
    });

    test('only PENDING, STARTING and PROCESSING are cancellable', () => {
        expect(new Set(CANCELLABLE_ACTION_STATES)).toEqual(
            new Set([
                ActionState.PENDING,
                ActionState.PROCESSING,
                ActionState.STARTING,
            ]),
        );
        expect(isCancellableActionState(ActionState.STOPPING)).toBe(false);
        expect(isCancellableActionState(ActionState.CANCELLED)).toBe(false);
    });
});

const buildRepository = (
    state: ActionState,
): {
    repository: Pick<Repository<ActionEntity>, 'findOneOrFail' | 'save'>;
    action: ActionEntity;
} => {
    const action = { uuid: 'action-uuid', state } as ActionEntity;
    return {
        action,
        repository: {
            findOneOrFail: jest.fn().mockResolvedValue(action),
            save: jest.fn().mockResolvedValue(action),
        } as unknown as Pick<
            Repository<ActionEntity>,
            'findOneOrFail' | 'save'
        >,
    };
};

describe('markJobAsCompleted state transition', () => {
    test('does not overwrite a CANCELLED action with DONE', async () => {
        const { repository, action } = buildRepository(ActionState.CANCELLED);
        await markJobAsCompleted(repository, 'action-uuid');
        expect(action.state).toBe(ActionState.CANCELLED);
        expect(repository.save).not.toHaveBeenCalled();
    });

    test('does not overwrite a FAILED action with DONE', async () => {
        const { repository, action } = buildRepository(ActionState.FAILED);
        await markJobAsCompleted(repository, 'action-uuid');
        expect(action.state).toBe(ActionState.FAILED);
        expect(repository.save).not.toHaveBeenCalled();
    });

    test('does not overwrite an UNPROCESSABLE action with DONE', async () => {
        const { repository, action } = buildRepository(
            ActionState.UNPROCESSABLE,
        );
        await markJobAsCompleted(repository, 'action-uuid');
        expect(action.state).toBe(ActionState.UNPROCESSABLE);
        expect(repository.save).not.toHaveBeenCalled();
    });

    test('marks a still running action as DONE', async () => {
        const { repository, action } = buildRepository(ActionState.STOPPING);
        await markJobAsCompleted(repository, 'action-uuid');
        expect(action.state).toBe(ActionState.DONE);
        expect(repository.save).toHaveBeenCalledTimes(1);
    });
});

describe('DeleteActionGuard', () => {
    const userUuid = 'user-uuid';

    const buildContext = (): ExecutionContext =>
        ({
            switchToHttp: () => ({
                getRequest: () => ({
                    body: {},
                    params: { uuid: 'action-uuid' },
                    user: { user: { uuid: userUuid } },
                }),
            }),
        }) as unknown as ExecutionContext;

    const buildGuard = (
        state: ActionState,
    ): { guard: DeleteActionGuard; canAccessMission: jest.Mock } => {
        const actionRepository = {
            findOneOrFail: jest.fn().mockResolvedValue({
                uuid: 'action-uuid',
                state,
                mission: { uuid: 'mission-uuid' },
                creator: { uuid: userUuid },
            }),
        } as unknown as Repository<ActionEntity>;

        const canAccessMission = jest.fn().mockResolvedValue(true);
        const missionGuardService = {
            canAccessMission,
        } as unknown as MissionGuardService;

        return {
            canAccessMission,
            guard: new DeleteActionGuard(missionGuardService, actionRepository),
        };
    };

    test.each(TERMINAL_ACTION_STATES)(
        'allows deleting an action in state %s',
        async (state) => {
            const { guard } = buildGuard(state);
            await expect(guard.canActivate(buildContext())).resolves.toBe(true);
        },
    );

    test.each([
        ActionState.PENDING,
        ActionState.STARTING,
        ActionState.PROCESSING,
        ActionState.STOPPING,
    ])('rejects deleting an action in state %s', async (state) => {
        const { guard } = buildGuard(state);
        await expect(guard.canActivate(buildContext())).rejects.toThrow(
            /can't delete action unless/,
        );
    });
});
