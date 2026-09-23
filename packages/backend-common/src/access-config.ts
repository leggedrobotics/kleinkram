import { AccessGroupConfig } from '@kleinkram/shared';
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
