import { AccessGroupConfig, AccessGroupRights } from '@kleinkram/shared';
import * as fs from 'node:fs';
import env from './environment';

/**
 * Load and validate the access group config of this deployment.
 *
 * The config is deployment specific (e.g. which mail domains are added to
 * which affiliation group) and is therefore never bundled into the image.
 * Its location must be set explicitly via ACCESS_CONFIG_PATH.
 *
 * @param configPath path to the config file, defaults to ACCESS_CONFIG_PATH
 * @returns the validated access group config
 */
/** Rights an affiliation group can get by default on new projects. */
const DEFAULT_GROUP_RIGHTS: readonly unknown[] = [
    AccessGroupRights.READ,
    AccessGroupRights.CREATE,
    AccessGroupRights.WRITE,
    AccessGroupRights.DELETE,
];

export const loadAccessConfig = (
    configPath: string | undefined = env.ACCESS_CONFIG_PATH,
): AccessGroupConfig => {
    if (configPath === undefined) {
        throw new Error(
            'ACCESS_CONFIG_PATH is not set. Point it to the access_config.json of this deployment.',
        );
    }

    let rawConfig: string;
    try {
        rawConfig = fs.readFileSync(configPath, 'utf8');
    } catch (error) {
        throw new Error(
            `Cannot read access config at "${configPath}": ${String(error)}`,
        );
    }

    let config: AccessGroupConfig | null;
    try {
        config = JSON.parse(rawConfig) as AccessGroupConfig | null;
    } catch (error) {
        throw new Error(
            `Cannot parse access config at "${configPath}": ${String(error)}`,
        );
    }

    validateAccessConfig(config);
    return config;
};

/**
 * Validate the structure of an access group config.
 *
 * @param config the parsed config
 */
export function validateAccessConfig(
    config: AccessGroupConfig | null,
): asserts config is AccessGroupConfig {
    if (
        config === null ||
        !Array.isArray(config.emails) ||
        !Array.isArray(config.access_groups)
    ) {
        throw new TypeError(
            'Invalid access config: "emails" and "access_groups" must be arrays',
        );
    }

    if (
        config.allow_external_users !== undefined &&
        typeof config.allow_external_users !== 'boolean'
    ) {
        throw new TypeError(
            `Invalid access config: "allow_external_users" must be true or false, got ${JSON.stringify(config.allow_external_users)}`,
        );
    }

    if (config.allow_external_users === false && config.emails.length === 0) {
        throw new TypeError(
            'Invalid access config: "allow_external_users" is false but "emails" is empty, so nobody could sign in',
        );
    }

    for (const group of config.access_groups) {
        if (!DEFAULT_GROUP_RIGHTS.includes(group.rights)) {
            throw new TypeError(
                `Invalid access config: "rights" of group "${group.uuid}" must be one of ${DEFAULT_GROUP_RIGHTS.join(', ')}, got ${JSON.stringify(group.rights)}`,
            );
        }
    }

    const groupUuids = new Set(config.access_groups.map((g) => g.uuid));
    for (const emailEntry of config.emails) {
        if (
            typeof emailEntry.email !== 'string' ||
            emailEntry.email === '' ||
            emailEntry.email.includes('@')
        ) {
            throw new TypeError(
                `Invalid access config: ${JSON.stringify(emailEntry.email)} must be a bare mail domain (e.g. "example.com")`,
            );
        }
        if (!Array.isArray(emailEntry.access_groups)) {
            throw new TypeError(
                'Invalid access config: each entry in "emails" must have an "access_groups" array',
            );
        }
        for (const uuid of emailEntry.access_groups) {
            if (!groupUuids.has(uuid)) {
                throw new TypeError(
                    `Invalid access config: UUID "${uuid}" in "emails" is not defined in "access_groups"`,
                );
            }
        }
    }
}

/**
 * Whether the email belongs to the given mail domain (exact domain match).
 *
 * @param email the user's email address
 * @param domain a bare mail domain, e.g. "example.com"
 */
export const emailMatchesDomain = (email: string, domain: string): boolean =>
    email.toLowerCase().endsWith(`@${domain.toLowerCase()}`);

/**
 * Whether users whose email is on none of the domains in `emails` can sign
 * in (`allow_external_users`, default `true`).
 *
 * @param config the access group config
 */
export const externalUsersAllowed = (config: AccessGroupConfig): boolean =>
    config.allow_external_users !== false;

/**
 * Whether the email is on one of the domains listed in `emails`.
 *
 * @param config the access group config
 * @param email the user's email address
 */
export const isInternalEmail = (
    config: AccessGroupConfig,
    email: string | null | undefined,
): boolean =>
    typeof email === 'string' &&
    config.emails.some((entry) => emailMatchesDomain(email, entry.email));

/**
 * Whether a user with this email may sign in (and keep a session): always
 * if `allow_external_users` is not `false`, otherwise only for emails on
 * one of the domains in `emails`.
 *
 * @param config the access group config
 * @param email the user's email address
 */
export const isEmailAllowedToSignIn = (
    config: AccessGroupConfig,
    email: string | null | undefined,
): boolean => externalUsersAllowed(config) || isInternalEmail(config, email);
