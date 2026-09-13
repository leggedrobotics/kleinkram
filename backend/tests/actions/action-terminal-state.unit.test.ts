import { ActionEntity } from '@kleinkram/backend-common';
import {
    ActionState,
    CANCELLABLE_ACTION_STATES,
    isCancellableActionState,
    isTerminalActionState,
    resolveCompletedActionState,
    TERMINAL_ACTION_STATES,
} from '@kleinkram/shared';
import { ExecutionContext } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DeleteActionGuard } from '../../src/endpoints/auth/guards/action.guards';
import { MissionGuardService } from '../../src/endpoints/auth/mission-guard.service';

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

describe('resolveCompletedActionState', () => {
    test.each(TERMINAL_ACTION_STATES)(
        'keeps the terminal state %s',
        (state) => {
            expect(resolveCompletedActionState(state)).toBe(state);
        },
    );

    test.each([
        ActionState.PENDING,
        ActionState.STARTING,
        ActionState.PROCESSING,
        ActionState.STOPPING,
    ])('promotes the non-terminal state %s to DONE', (state) => {
        expect(resolveCompletedActionState(state)).toBe(ActionState.DONE);
    });

    test('resolves every action state to a terminal state', () => {
        for (const state of Object.values(ActionState)) {
            expect(
                isTerminalActionState(resolveCompletedActionState(state)),
            ).toBe(true);
        }
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
