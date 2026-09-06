import { ActionState } from './enum';

/**
 * The states in which an action has reached its final outcome.
 *
 * Once an action is in one of these states, it will not transition
 * to any other state anymore. Consumers use this to decide whether an
 * action may still be cancelled, whether it may be deleted, and whether
 * a late state update (e.g. from a queue lifecycle hook) may still
 * overwrite the recorded state.
 */
export const TERMINAL_ACTION_STATES: readonly ActionState[] = [
    ActionState.DONE,
    ActionState.FAILED,
    ActionState.UNPROCESSABLE,
    ActionState.CANCELLED,
];

/**
 * @returns true if the given action state is final and must not be overwritten.
 */
export const isTerminalActionState = (state: ActionState): boolean =>
    TERMINAL_ACTION_STATES.includes(state);

/**
 * The states in which an action is still in flight and can be cancelled.
 */
export const CANCELLABLE_ACTION_STATES: readonly ActionState[] = [
    ActionState.PENDING,
    ActionState.STARTING,
    ActionState.PROCESSING,
];

/**
 * @returns true if the given action state still allows the action to be cancelled.
 */
export const isCancellableActionState = (state: ActionState): boolean =>
    CANCELLABLE_ACTION_STATES.includes(state);
