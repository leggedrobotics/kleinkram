import { ActionSeverity, DiagnosticSeverity } from './enum';

/**
 * The exit code an action container uses to report "finished, but with
 * warnings".
 *
 * Exit codes are a namespace shared with the kernel, the shell and every tool
 * in the image, so exactly one value is reserved. 75 is `EX_TEMPFAIL` from
 * `sysexits.h`, the closest thing the UNIX conventions have to an outcome that
 * is neither a clean success nor a hard error, and it sits outside both the
 * Docker range (125-127) and the signal range (128+n) the runner already reads.
 *
 * Actions that can install the Kleinkram CLI should prefer `klein action warn`,
 * which carries a message instead of a number.
 */
export const EXIT_CODE_WARNING = 75;

/**
 * The maximum number of distinct diagnostics kept per action.
 *
 * An action looping over thousands of files can report thousands of findings;
 * past this point the list stops being readable and starts being a denial of
 * service on our own database. Later reports are dropped and the action is
 * flagged as truncated.
 */
export const ACTION_DIAGNOSTIC_LIMIT = 500;

/**
 * Severities ordered from least to most severe. Used to compare two verdicts.
 */
const ACTION_SEVERITY_RANK: Record<ActionSeverity, number> = {
    [ActionSeverity.OK]: 0,
    [ActionSeverity.WARNING]: 1,
    [ActionSeverity.ERROR]: 2,
};

/**
 * @returns the more severe of the two verdicts.
 */
export const maxActionSeverity = (
    a: ActionSeverity,
    b: ActionSeverity,
): ActionSeverity =>
    ACTION_SEVERITY_RANK[a] >= ACTION_SEVERITY_RANK[b] ? a : b;

/**
 * The severities strictly less severe than the given one.
 *
 * Used to raise an action's verdict with a conditional UPDATE, so that a
 * concurrent report can never talk a higher verdict back down.
 *
 * @param severity the verdict being written
 * @returns the verdicts it is allowed to overwrite
 */
export const severitiesBelow = (severity: ActionSeverity): ActionSeverity[] =>
    Object.values(ActionSeverity).filter(
        (candidate) =>
            ACTION_SEVERITY_RANK[candidate] < ACTION_SEVERITY_RANK[severity],
    );

/**
 * Maps a single diagnostic's severity onto the verdict it implies for the
 * action as a whole.
 *
 * `INFO` deliberately maps to `OK`: an action that only left notes behind is
 * still a clean run, and colouring it otherwise would train people to ignore
 * the badge.
 *
 * @param severity the severity the container reported
 * @returns the verdict this diagnostic contributes to the action
 */
export const actionSeverityFromDiagnostic = (
    severity: DiagnosticSeverity,
): ActionSeverity => {
    switch (severity) {
        case DiagnosticSeverity.ERROR: {
            return ActionSeverity.ERROR;
        }
        case DiagnosticSeverity.WARNING: {
            return ActionSeverity.WARNING;
        }
        case DiagnosticSeverity.INFO: {
            return ActionSeverity.OK;
        }
    }
};
