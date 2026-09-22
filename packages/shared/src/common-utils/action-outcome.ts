import { EXIT_CODE_WARNING } from './action-severity';
import { isTerminalActionState } from './action-state';
import { ActionFailureOrigin, ActionSeverity, ActionState } from './enum';

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
 * responsible if it failed, and a human-readable cause.
 */
export interface ActionOutcome {
    state: ActionState;
    severity: ActionSeverity;

    /** Only set when `state` is `FAILED`. */
    failureOrigin?: ActionFailureOrigin;
    stateCause: string;
}

const failure = (
    stateCause: string,
    failureOrigin: ActionFailureOrigin,
): ActionOutcome => ({
    state: ActionState.FAILED,
    severity: ActionSeverity.ERROR,
    failureOrigin,
    stateCause,
});

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
                stateCause: 'Container exited with code 0',
            };
        }
        case EXIT_CODE_WARNING: {
            return {
                state: ActionState.DONE,
                severity: ActionSeverity.WARNING,
                stateCause: `Action completed with warnings (exit ${EXIT_CODE_WARNING.toString()}).`,
            };
        }
        case 125: {
            return failure(
                'Container failed to run. Docker run command failed.',
                ActionFailureOrigin.USER,
            );
        }
        case 126: {
            return failure(
                'Command cannot be invoked (Permission denied?).',
                ActionFailureOrigin.USER,
            );
        }
        case 127: {
            return failure('Command not found.', ActionFailureOrigin.USER);
        }
        case 139: {
            return failure(
                'Container crashed (SIGSEGV). Invalid memory access.',
                ActionFailureOrigin.USER,
            );
        }
        case 143: {
            return failure(
                'Container stopped (SIGTERM). Time limit approached.',
                ActionFailureOrigin.USER,
            );
        }
        case 137: {
            // Docker reports OOM kills explicitly. The original, ambiguous
            // wording is kept as a prefix so that existing log analysis and
            // the error hint service keep matching on it.
            return failure(
                oomKilled === true
                    ? 'Container killed (SIGKILL). Exceeded memory or CPU limit. The container ran out of memory (OOMKilled).'
                    : 'Container killed (SIGKILL). Exceeded memory or CPU limit.',
                ActionFailureOrigin.USER,
            );
        }
        default: {
            // A non-zero exit the action chose itself.
            return failure(
                `Container exited with code ${exitCode.toString()}`,
                ActionFailureOrigin.USER,
            );
        }
    }
};

/**
 * A verdict already stored for the action when the container stopped.
 */
export interface RecordedVerdict {
    state: ActionState;
    failureOrigin?: ActionFailureOrigin;
    stateCause?: string;
}

/**
 * Chooses between a verdict already recorded for the action and the one the
 * exit code implies.
 *
 * The janitor kills containers - for running past `maxRuntime`, or because a
 * newer runner took over - and records why before the runner ever inspects the
 * corpse. By then the exit code only describes *how* the container died, a 137
 * or a 143, so re-deriving from it would overwrite "Time limit exceeded" with a
 * guess about memory limits, and would pin a runner interrupt on the user. A
 * state that is already final therefore wins.
 *
 * Kept pure, and separate from the runner, so the precedence can be tested
 * directly rather than through a container lifecycle.
 *
 * @param recorded what the action row says, or null if it could not be read
 * @param outcome what the exit code implies
 * @returns the state, blame and cause to persist
 */
export const resolveFinalVerdict = (
    recorded: RecordedVerdict | null | undefined,
    outcome: ActionOutcome,
): Omit<ActionOutcome, 'severity'> =>
    recorded && isTerminalActionState(recorded.state)
        ? {
              state: recorded.state,
              failureOrigin: recorded.failureOrigin,
              stateCause: recorded.stateCause ?? outcome.stateCause,
          }
        : outcome;
