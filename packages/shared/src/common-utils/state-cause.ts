import { ActionFailureOrigin } from './enum';

/**
 * Why an action is in its current state.
 *
 * Stored as plain text (`varchar`), not as a Postgres enum: the API server and
 * the queue consumer are updated independently, so a newer service may write a
 * code an older one has never heard of. Readers must therefore treat the
 * stored value as an open set - see {@link describeStateCause}.
 *
 * Adding a cause needs no migration: add it here and to {@link STATE_CAUSES}.
 * Never rename or reuse a value; rows written with it stay in the database.
 */
export enum ActionStateCause {
    SUBMITTED = 'SUBMITTED',
    WAITING_FOR_RESOURCES = 'WAITING_FOR_RESOURCES',
    STARTING = 'STARTING',
    RUNNING = 'RUNNING',
    STOPPING = 'STOPPING',

    COMPLETED = 'COMPLETED',
    COMPLETED_WITH_WARNINGS = 'COMPLETED_WITH_WARNINGS',

    EXIT_NONZERO = 'EXIT_NONZERO',
    EXIT_DOCKER_RUN_FAILED = 'EXIT_DOCKER_RUN_FAILED',
    EXIT_PERMISSION_DENIED = 'EXIT_PERMISSION_DENIED',
    EXIT_COMMAND_NOT_FOUND = 'EXIT_COMMAND_NOT_FOUND',
    EXIT_SEGFAULT = 'EXIT_SEGFAULT',
    EXIT_SIGTERM = 'EXIT_SIGTERM',
    EXIT_SIGKILL = 'EXIT_SIGKILL',
    OUT_OF_MEMORY = 'OUT_OF_MEMORY',
    TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
    MISSION_ACCESS_LOST = 'MISSION_ACCESS_LOST',

    RUNNER_REPLACED = 'RUNNER_REPLACED',
    ORPHANED_CONTAINER_KILLED = 'ORPHANED_CONTAINER_KILLED',
    CONTAINER_LOST = 'CONTAINER_LOST',
    NO_WORKER_AVAILABLE = 'NO_WORKER_AVAILABLE',
    QUEUE_ERROR = 'QUEUE_ERROR',
    WORKER_NOT_FOUND = 'WORKER_NOT_FOUND',
    INTERNAL_ERROR = 'INTERNAL_ERROR',

    CANCELLED_BY_USER = 'CANCELLED_BY_USER',
}

/**
 * A cause as it is written: the code, anything the text needs beyond the
 * action itself, and the raw text of an external error, if there was one.
 *
 * References to the action's own creator and mission are never stored in
 * `params`; they are on the action already. Other entities go in `params` as
 * uuids, never as names, so a rename shows up everywhere.
 */
/** Extra values a cause's text needs. Flat JSON, so it fits a jsonb column. */
export type StateCauseParams = Record<string, string | number | boolean | null>;

export interface StateCause {
    code: ActionStateCause;
    params?: StateCauseParams;

    /** Raw text from outside Kleinkram (Docker, an exception). Never parsed. */
    message?: string;
}

/**
 * Current names of the entities a cause may mention. Absent when the cause is
 * described at write time, which is why every text has a nameless form.
 */
export interface StateCauseContext {
    creatorName?: string;
    missionName?: string;
    actorName?: string;
}

interface StateCauseDefinition {
    /** Who is responsible when the cause ends the action as a failure. */
    failureOrigin?: ActionFailureOrigin;
    describe: (cause: StateCause, context: StateCauseContext) => string;
}

const fixed =
    (text: string): StateCauseDefinition['describe'] =>
    () =>
        text;

/** Params come back from the database untyped, so they are read defensively. */
const numberParameter = (
    cause: StateCause,
    key: string,
): number | undefined => {
    const value = cause.params?.[key];
    return typeof value === 'number' ? value : undefined;
};

/**
 * The single place that says what each cause means. A `Record` over the enum,
 * so the type check fails for a cause without a text.
 */
export const STATE_CAUSES: Record<ActionStateCause, StateCauseDefinition> = {
    [ActionStateCause.SUBMITTED]: {
        describe: (_cause, { actorName }) =>
            actorName ? `Submitted by ${actorName}` : 'Submitted',
    },
    [ActionStateCause.WAITING_FOR_RESOURCES]: {
        describe: ({ message }) =>
            message
                ? `Waiting for resources: ${message}`
                : 'Waiting for resources',
    },
    [ActionStateCause.STARTING]: {
        describe: fixed('Pulling the image and starting the container'),
    },
    [ActionStateCause.RUNNING]: {
        describe: fixed('The action container is running'),
    },
    [ActionStateCause.STOPPING]: {
        describe: fixed('The container exited; collecting results'),
    },

    [ActionStateCause.COMPLETED]: {
        describe: fixed('Completed successfully'),
    },
    [ActionStateCause.COMPLETED_WITH_WARNINGS]: {
        describe: (cause) =>
            `Action completed with warnings (exit ${String(numberParameter(cause, 'exitCode') ?? 75)}).`,
    },

    [ActionStateCause.EXIT_NONZERO]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: (cause) => {
            const exitCode = numberParameter(cause, 'exitCode');
            return exitCode === undefined
                ? 'Container exited with an error'
                : `Container exited with code ${exitCode.toString()}`;
        },
    },
    [ActionStateCause.EXIT_DOCKER_RUN_FAILED]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Container failed to run. Docker run command failed.'),
    },
    [ActionStateCause.EXIT_PERMISSION_DENIED]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Command cannot be invoked (Permission denied?).'),
    },
    [ActionStateCause.EXIT_COMMAND_NOT_FOUND]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Command not found.'),
    },
    [ActionStateCause.EXIT_SEGFAULT]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Container crashed (SIGSEGV). Invalid memory access.'),
    },
    [ActionStateCause.EXIT_SIGTERM]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Container stopped (SIGTERM). Time limit approached.'),
    },
    [ActionStateCause.EXIT_SIGKILL]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed(
            'Container killed (SIGKILL). Exceeded memory or CPU limit.',
        ),
    },
    [ActionStateCause.OUT_OF_MEMORY]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed(
            'Container killed (SIGKILL). The container ran out of memory (OOMKilled).',
        ),
    },
    [ActionStateCause.TIME_LIMIT_EXCEEDED]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: fixed('Time limit exceeded'),
    },
    [ActionStateCause.MISSION_ACCESS_LOST]: {
        failureOrigin: ActionFailureOrigin.USER,
        describe: (_cause, { creatorName, missionName }) =>
            creatorName && missionName
                ? `User ${creatorName} lost access to mission ${missionName}`
                : 'The creator of this action lost write access to its mission',
    },

    [ActionStateCause.RUNNER_REPLACED]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed(
            'Interrupted because its runner became inactive and was replaced',
        ),
    },
    [ActionStateCause.ORPHANED_CONTAINER_KILLED]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed('Container stopped: the action was no longer active'),
    },
    [ActionStateCause.CONTAINER_LOST]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed('Container crashed, no container found'),
    },
    [ActionStateCause.NO_WORKER_AVAILABLE]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed(
            'No worker available with the required hardware capabilities',
        ),
    },
    [ActionStateCause.QUEUE_ERROR]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed('Resources unavailable or queue error'),
    },
    [ActionStateCause.WORKER_NOT_FOUND]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: fixed('Worker not found'),
    },
    [ActionStateCause.INTERNAL_ERROR]: {
        failureOrigin: ActionFailureOrigin.SYSTEM,
        describe: ({ message }) => message ?? 'Internal error',
    },

    [ActionStateCause.CANCELLED_BY_USER]: {
        describe: (_cause, { actorName }) =>
            actorName
                ? `Cancelled by ${actorName}`
                : 'Action cancelled by user',
    },
};

export const isKnownStateCause = (code: unknown): code is ActionStateCause =>
    typeof code === 'string' && Object.hasOwn(STATE_CAUSES, code);

/**
 * The text for a stored cause, or `undefined` when this version does not know
 * the code - the caller then shows the text that was stored with it.
 */
export const describeStateCause = (
    stored: {
        code?: string | null;
        params?: StateCauseParams | null;
        message?: string | null;
    },
    context: StateCauseContext = {},
): string | undefined => {
    if (!isKnownStateCause(stored.code)) return stored.message ?? undefined;
    return STATE_CAUSES[stored.code].describe(
        {
            code: stored.code,
            params: stored.params ?? undefined,
            message: stored.message ?? undefined,
        },
        context,
    );
};

/** Who is to blame when `cause` ends an action as a failure. */
export const failureOriginOf = (
    cause: StateCause,
): ActionFailureOrigin | undefined => STATE_CAUSES[cause.code].failureOrigin;

/**
 * An error that knows which cause it stands for, so a failure thrown deep in
 * the runner reaches the action as a code rather than as text to be parsed.
 */
export class StateCauseError extends Error {
    readonly stateCause: StateCause;

    constructor(cause: StateCause) {
        super(describeStateCause(cause) ?? cause.code);
        this.name = 'StateCauseError';
        this.stateCause = cause;
    }
}

/**
 * The cause for an error that ended an action: its own code if it carries
 * one, otherwise an internal error keeping the raw message.
 */
export const stateCauseOfError = (error: unknown): StateCause =>
    error instanceof StateCauseError
        ? error.stateCause
        : {
              code: ActionStateCause.INTERNAL_ERROR,
              message: error instanceof Error ? error.message : String(error),
          };
