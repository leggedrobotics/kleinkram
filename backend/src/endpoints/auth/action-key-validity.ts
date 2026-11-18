import { ApiKeyEntity } from '@kleinkram/backend-common';
import { isTerminalActionState, KeyTypes } from '@kleinkram/shared';

/**
 * How long an action key stays valid beyond the action's runtime limit.
 *
 * The key is created when the worker picks the action up, before the image
 * pull, while the runtime limit counts from the container start. The grace
 * covers the image pull.
 */
export const ACTION_KEY_GRACE_MS = 60 * 60 * 1000;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Why an action key must be rejected, or `undefined` if it may be used.
 *
 * An action key normally dies when the worker disposes of it at the end of
 * the run. A worker that is killed (SIGKILL, OOM, lost node) never gets
 * there, so the key itself carries no lifetime. This check bounds it anyway:
 * the key only works while its action is still running, and never longer than
 * the action's runtime limit plus {@link ACTION_KEY_GRACE_MS}.
 *
 * Expects `apiKey.action` and `apiKey.action.template` to be loaded. Keys of
 * other types are not affected.
 */
export const actionKeyRejection = (
    apiKey: Readonly<ApiKeyEntity>,
    now: Date = new Date(),
): string | undefined => {
    // KeyTypes has a single member today; this keeps the check scoped to
    // action keys once another type exists.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (apiKey.key_type !== KeyTypes.ACTION) return undefined;

    const action = apiKey.action;
    // A deleted action, or one that was never linked to the key.
    if (!action) return 'action key has no action';

    if (isTerminalActionState(action.state)) {
        return 'action key belongs to a finished action';
    }

    const maxRuntimeHours =
        action.maxRuntimeHours ?? action.template?.maxRuntime;
    // Without a limit there is nothing to bound the key by; the state check
    // above still applies.
    if (maxRuntimeHours === undefined) return undefined;

    const expiresAt =
        apiKey.createdAt.getTime() +
        maxRuntimeHours * HOUR_MS +
        ACTION_KEY_GRACE_MS;
    if (now.getTime() > expiresAt) return 'action key has expired';

    return undefined;
};
