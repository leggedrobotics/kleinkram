import { EXIT_CODE_WARNING } from './action-severity';
import { ActionFailureOrigin, ActionSeverity, ActionState } from './enum';

/**
 * What the runner observed when the action container stopped.
 *
 * Only `exitCode` is always known. The remaining facts are available on the
 * paths that produce them: `oomKilled` comes from `container.inspect()`, while
 * the interrupt and timeout flags are set by the janitor, which is the only
 * component that knows it killed the container and why.
 */
export interface ContainerExitFacts {
    exitCode: number;

    /** Docker reported the container was killed by the OOM killer. */
    oomKilled?: boolean;

    /** The runner terminated the container because it took over from an older instance. */
    interruptedByRunner?: boolean;

    /** The container was terminated for running past the template's `maxRuntime`. */
    runtimeLimitExceeded?: boolean;
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
 * with severity `WARNING`.
 *
 * @param facts what the runner observed when the container stopped
 * @returns the state, severity, blame and cause to persist
 */
export const resolveActionOutcome = (
    facts: ContainerExitFacts,
): ActionOutcome => {
    const { exitCode, oomKilled, interruptedByRunner, runtimeLimitExceeded } =
        facts;

    if (interruptedByRunner) {
        return failure(
            'Interrupted by new Runner Instance.',
            ActionFailureOrigin.SYSTEM,
        );
    }

    if (runtimeLimitExceeded) {
        return failure(
            'Time limit exceeded. The action ran longer than its template allows.',
            ActionFailureOrigin.USER,
        );
    }

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
