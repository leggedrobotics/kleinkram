import { EXIT_CODE_WARNING } from './action-severity';
import { ActionFailureOrigin, ActionSeverity, ActionState } from './enum';
import {
    ActionStateCause,
    failureOriginOf,
    StateCause,
    StateCauseParams,
} from './state-cause';

/**
 * What the runner observed when the action container stopped.
 *
 * Only what Docker reports is available here. When the janitor killed the
 * container it has already recorded why, and the caller keeps that verdict
 * rather than asking this function to re-derive it - what we would see is the
 * consequence of the kill (a 137 or a 143), not its reason.
 */
export interface ContainerExitFacts {
    exitCode: number;

    /** Docker reported the container was killed by the OOM killer. */
    oomKilled?: boolean;
}

/**
 * The full outcome of an action run: its lifecycle state, its verdict, who is
 * responsible if it failed, and why.
 */
export interface ActionOutcome {
    state: ActionState;
    severity: ActionSeverity;

    /** Only set when `state` is `FAILED`. */
    failureOrigin?: ActionFailureOrigin;
    cause: StateCause;
}

const failure = (
    code: ActionStateCause,
    params?: StateCauseParams,
): ActionOutcome => {
    const cause: StateCause = { code, ...(params && { params }) };
    return {
        state: ActionState.FAILED,
        severity: ActionSeverity.ERROR,
        failureOrigin: failureOriginOf(cause),
        cause,
    };
};

/**
 * Turns what the runner saw at container exit into the outcome to record.
 *
 * This is the single place that decides what an exit code means. It is pure so
 * that the mapping can be tested exhaustively rather than inferred from the
 * runner's control flow.
 *
 * Note that the verdict returned here is only the part the exit code implies.
 * Diagnostics reported by the container during the run are merged on top of it
 * by the caller, so a run that exits 0 after reporting warnings still ends up
 * with severity `WARNING`. A verdict the janitor already recorded is likewise
 * preserved by the caller, and never recomputed from the exit code here.
 *
 * @param facts what the runner observed when the container stopped
 * @returns the state, severity, blame and cause to persist
 */
export const resolveActionOutcome = (
    facts: ContainerExitFacts,
): ActionOutcome => {
    const { exitCode, oomKilled } = facts;

    switch (exitCode) {
        case 0: {
            return {
                state: ActionState.DONE,
                severity: ActionSeverity.OK,
                cause: { code: ActionStateCause.COMPLETED },
            };
        }
        case EXIT_CODE_WARNING: {
            return {
                state: ActionState.DONE,
                severity: ActionSeverity.WARNING,
                cause: {
                    code: ActionStateCause.COMPLETED_WITH_WARNINGS,
                    params: { exitCode },
                },
            };
        }
        case 125: {
            return failure(ActionStateCause.EXIT_DOCKER_RUN_FAILED);
        }
        case 126: {
            return failure(ActionStateCause.EXIT_PERMISSION_DENIED);
        }
        case 127: {
            return failure(ActionStateCause.EXIT_COMMAND_NOT_FOUND);
        }
        case 139: {
            return failure(ActionStateCause.EXIT_SEGFAULT);
        }
        case 143: {
            return failure(ActionStateCause.EXIT_SIGTERM);
        }
        case 137: {
            // Docker reports OOM kills explicitly; without that flag a SIGKILL
            // may as well have come from the CPU limit.
            return failure(
                oomKilled === true
                    ? ActionStateCause.OUT_OF_MEMORY
                    : ActionStateCause.EXIT_SIGKILL,
            );
        }
        default: {
            // A non-zero exit the action chose itself.
            return failure(ActionStateCause.EXIT_NONZERO, { exitCode });
        }
    }
};
