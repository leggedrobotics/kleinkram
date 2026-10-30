import { ActionStateTransitionEntity } from '@backend-common/entities/action/action-state-transition.entity';
import { ActionEntity } from '@backend-common/entities/action/action.entity';
import {
    ActionFailureOrigin,
    ActionState,
    describeStateCause,
    failureOriginOf,
    StateCause,
} from '@kleinkram/shared';
import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface ActionTransition {
    state: ActionState;
    cause: StateCause;

    /** The user who caused the change, e.g. who cancelled the action. */
    actorUuid?: string | undefined;

    /**
     * Leave the action alone when it is in one of these states. Checked under
     * a row lock, so a verdict another component just recorded cannot be
     * overwritten between reading and writing.
     */
    unlessIn?: readonly ActionState[];

    /** Further columns to write in the same update, e.g. the severity. */
    set?: QueryDeepPartialEntity<ActionEntity>;
}

const FAILURE_STATES: ReadonlySet<ActionState> = new Set([
    ActionState.FAILED,
    ActionState.UNPROCESSABLE,
]);

/**
 * Moves an action to a new state and records why.
 *
 * Every change of `action.state` goes through here: it updates the action and
 * appends to its state history in one transaction, so the two never disagree.
 * Writing the same state and cause again (cancellation is reported by both the
 * API and the runner) updates the action but adds no second history row.
 *
 * @returns whether the action was changed; false if it no longer exists or
 * was in one of the `unlessIn` states
 */
export const transitionAction = async (
    manager: EntityManager,
    actionUuid: string,
    transition: ActionTransition,
): Promise<boolean> => {
    const apply = async (transaction: EntityManager): Promise<boolean> => {
        const current = await transaction.findOne(ActionEntity, {
            where: { uuid: actionUuid },
            select: {
                uuid: true,
                state: true,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause_code: true,
            },
            lock: { mode: 'pessimistic_write' },
        });
        if (!current) return false;
        if (transition.unlessIn?.includes(current.state)) return false;

        const { state, cause } = transition;
        const failureOrigin: ActionFailureOrigin | undefined =
            FAILURE_STATES.has(state)
                ? (failureOriginOf(cause) ?? ActionFailureOrigin.SYSTEM)
                : undefined;

        await transaction.update(
            ActionEntity,
            { uuid: actionUuid },
            {
                ...transition.set,
                state,
                ...(failureOrigin && { failureOrigin }),
                // The raw message if there is one, so that it survives on the
                // action itself; the serializer rebuilds the text around it.
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause:
                    cause.message ?? describeStateCause(cause) ?? cause.code,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause_code: cause.code,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                state_cause_params: cause.params ?? null,
            },
        );

        const changed =
            current.state !== state || current.state_cause_code !== cause.code;
        if (changed) {
            await transaction.insert(ActionStateTransitionEntity, {
                actionUuid,
                state,
                causeCode: cause.code,
                causeParams: cause.params ?? null,
                message: cause.message ?? null,
                actorUuid: transition.actorUuid ?? null,
            });
        }
        return true;
    };

    return manager.queryRunner?.isTransactionActive
        ? apply(manager)
        : manager.transaction(apply);
};
