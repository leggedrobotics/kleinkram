/**
 * Entity references inside an action's `state_cause`.
 *
 * The state cause is persisted as plain text, but names can change (user
 * names come from the OAuth provider, missions can be renamed). So the
 * writer stores a reference like `{user:<uuid>}` and the API replaces it with
 * the current name when it serializes the action.
 */
export type StateCauseReferenceKind = 'user' | 'mission';

const UUID_PATTERN =
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const REFERENCE_REGEX = new RegExp(
    String.raw`\{(user|mission):(${UUID_PATTERN})\}`,
    'gi',
);

export const stateCauseReference = (
    kind: StateCauseReferenceKind,
    uuid: string,
): string => `{${kind}:${uuid}}`;

/**
 * Replaces entity references with the names in `names` (keyed by uuid).
 * A reference to an unknown uuid falls back to the bare uuid.
 *
 * Bare uuids in `names` are replaced as well, so causes written before
 * references existed (e.g. `User <uuid> lost access to mission <uuid>`)
 * also show names.
 */
export const resolveStateCause = (
    stateCause: string,
    names: Readonly<Record<string, string | undefined>>,
): string => {
    const lookup = (uuid: string): string | undefined =>
        names[uuid.toLowerCase()];

    let resolved = stateCause.replaceAll(
        REFERENCE_REGEX,
        (_match, _kind: string, uuid: string) => lookup(uuid) ?? uuid,
    );

    for (const [uuid, name] of Object.entries(names)) {
        if (name) resolved = resolved.replaceAll(uuid, name);
    }
    return resolved;
};
