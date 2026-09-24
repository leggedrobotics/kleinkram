/**
 * Ensures extracted environment variable is a string
 *
 * @param key - environment variable name
 * @returns environment variable as string
 */
function asString(key: string): string {
    const value = process.env[key];
    if (value === undefined) {
        const message = `The environment variable "${key}" cannot be "undefined".`;
        throw new Error(message);
    }

    return value;
}

/**
 * Ensures extracted environment variable is a number
 *
 * @param key - environment variable name
 * @returns environment variable as integer
 */
function asNumber(key: string): number {
    const stringValue = asString(key);
    const numberValue = Number.parseFloat(stringValue);

    if (Number.isNaN(numberValue)) {
        const message = `The environment variable "${key}" has to hold a stringified number value - not ${stringValue}`;
        throw new Error(message);
    }

    return numberValue;
}

/**
 * Ensures extracted environment variable is a boolean
 *
 * @param key - environment variable name
 * @returns environment variable as boolean
 */
function asBoolean(key: string): boolean {
    const stringVariable = asString(key);
    if (!(stringVariable === 'true' || stringVariable === 'false')) {
        const message = `The environment variable "${key}" has to hold a stringified boolean value - not ${stringVariable}`;
        throw new Error(message);
    }
    return stringVariable === 'true';
}

/**
 * Returns environment variable as string or undefined if not set
 *
 * @param key - environment variable name
 * @returns environment variable as string or undefined
 */
function asOptionalString(key: string): string | undefined {
    const value = process.env[key];
    if (value === undefined || value === '') {
        return undefined;
    }
    return value;
}

/** Who makes archived objects read-only, see `ARCHIVE_SEAL_MODE`. */
export type ArchiveSealMode = 'storage' | 'self';

export default {
    /**
     * @returns database name
     */
    get DB_DATABASE(): string {
        return asString('DB_DATABASE');
    },
    /**
     * @returns database admin user
     */
    get DB_USER(): string {
        return asString('DB_USER');
    },
    /**
     * @returns database admin password
     */
    get DB_PASSWORD(): string {
        return asString('DB_PASSWORD');
    },
    /**
     * @returns database port
     */
    get DB_PORT(): number {
        return asNumber('DB_PORT');
    },
    /**
     * @returns database host name
     * @example database
     */
    get DB_HOST(): string {
        return asString('DB_HOST');
    },
    get SEED(): boolean {
        if (process.env.SEED === undefined) {
            return false;
        }
        return asBoolean('SEED');
    },
    /**
     * @returns whether application runs in development mode
     */
    get DEV(): boolean {
        return asBoolean('DEV');
    },

    /**
     * @returns glob describing where typeorm entities are found
     * @example dist/entities/*.entities.js
     */
    get ENTITIES(): string {
        return asString('ENTITIES');
    },
    /**
     * @returns backend port for lambda functions
     */
    get SERVER_PORT(): number {
        return asNumber('SERVER_PORT');
    },

    get S3_ACCESS_KEY(): string {
        return asString('S3_ACCESS_KEY');
    },

    get S3_SECRET_KEY(): string {
        return asString('S3_SECRET_KEY');
    },

    get S3_DATA_BUCKET_NAME(): string {
        return asString('S3_DATA_BUCKET_NAME');
    },
    get S3_DB_BUCKET_NAME(): string {
        return asString('S3_DB_BUCKET_NAME');
    },
    get S3_ENDPOINT(): string {
        return asString('S3_ENDPOINT');
    },

    get S3_REGION(): string | undefined {
        return asOptionalString('S3_REGION');
    },

    get S3_ENDPOINT_INTERNAL(): string | undefined {
        return asOptionalString('S3_ENDPOINT_INTERNAL');
    },

    get S3_USER(): string {
        return asString('S3_USER');
    },

    get S3_PASSWORD(): string {
        return asString('S3_PASSWORD');
    },

    get GOOGLE_CLIENT_ID(): string | undefined {
        return asOptionalString('GOOGLE_CLIENT_ID');
    },
    get GOOGLE_CLIENT_SECRET(): string | undefined {
        return asOptionalString('GOOGLE_CLIENT_SECRET');
    },

    get GITHUB_CLIENT_ID(): string | undefined {
        return asOptionalString('GITHUB_CLIENT_ID');
    },

    get GITHUB_CLIENT_SECRET(): string | undefined {
        return asOptionalString('GITHUB_CLIENT_SECRET');
    },

    get JWT_SECRET(): string {
        return asString('JWT_SECRET');
    },

    get FRONTEND_URL(): string {
        return asString('FRONTEND_URL');
    },

    get BACKEND_URL(): string {
        return asString('BACKEND_URL');
    },

    get GOOGLE_KEY_FILE(): string {
        return asString('GOOGLE_KEY_FILE');
    },

    get ARTIFACTS_UPLOADER_IMAGE(): string {
        return asString('ARTIFACTS_UPLOADER_IMAGE');
    },

    get S3_ARTIFACTS_BUCKET_NAME(): string {
        return asString('S3_ARTIFACTS_BUCKET_NAME');
    },

    /**
     * Bucket holding the single-file scripts submitted through
     * `klein action run-script`.
     *
     * Unlike the other three buckets this one falls back to a default instead
     * of throwing, so that an existing deployment keeps booting after an
     * upgrade without first adding the variable to its environment.
     */
    get S3_SCRIPTS_BUCKET_NAME(): string {
        return asOptionalString('S3_SCRIPTS_BUCKET_NAME') ?? 'action-scripts';
    },

    get DOCS_URL(): string {
        return asString('DOCS_URL');
    },

    /**
     * @returns base URL of the Loki instance storing action logs
     * @example http://loki:3100
     */
    get LOKI_URL(): string {
        return asOptionalString('LOKI_URL') ?? 'http://loki:3100';
    },

    get VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT(): boolean {
        return asBoolean('VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT');
    },

    get ACCESS_CONFIG_PATH(): string | undefined {
        return asOptionalString('ACCESS_CONFIG_PATH');
    },

    /**
     * @returns Docker Hub namespace for image validation (optional)
     * @example rslethz/
     */
    get DOCKER_HUB_NAMESPACE(): string {
        return process.env.VITE_DOCKER_HUB_NAMESPACE ?? '';
    },
    /**
     * @returns mount point of the archive storage, e.g. an NFS export of
     *   ETH LTS, see `ArchiveStorage` for what the storage has to provide
     */
    get ARCHIVE_ROOT(): string {
        return asOptionalString('ARCHIVE_ROOT') ?? '/mnt/archive';
    },

    /**
     * @returns local scratch disk that recalled tar parts are copied to
     *   before they are unpacked; needs room for one part
     */
    get ARCHIVE_STAGING_DIR(): string {
        return (
            asOptionalString('ARCHIVE_STAGING_DIR') ?? '/tmp/archive-staging'
        );
    },

    /**
     * @returns target size of one tar part; tape libraries such as ETH LTS
     *   want objects of 10-200 GB
     */
    get ARCHIVE_PART_SIZE_BYTES(): number {
        const value = asOptionalString('ARCHIVE_PART_SIZE_BYTES');
        return value === undefined
            ? 100 * 1024 ** 3
            : Number.parseInt(value, 10);
    },

    /**
     * @returns who seals archived objects: `storage` waits for the storage to
     *   make them read-only (ETH LTS: after 1 h), `self` does it on write
     */
    get ARCHIVE_SEAL_MODE(): ArchiveSealMode {
        const value = asOptionalString('ARCHIVE_SEAL_MODE') ?? 'storage';
        if (value !== 'storage' && value !== 'self') {
            throw new Error(
                `ARCHIVE_SEAL_MODE must be "storage" or "self", not ${value}`,
            );
        }
        return value;
    },

    /**
     * @returns seconds a mock waits to "mount a tape" before a recall; keep
     *   0 against real storage, which is slow on its own
     */
    get ARCHIVE_SIMULATED_RECALL_SECONDS(): number {
        const value = asOptionalString('ARCHIVE_SIMULATED_RECALL_SECONDS');
        return value === undefined ? 0 : Number.parseFloat(value);
    },

    /**
     * @returns how often a phase of an archive or restore is tried before it
     *   gives up (purging S3 never gives up, see the archive processor)
     */
    get ARCHIVE_MAX_ATTEMPTS(): number {
        const value = asOptionalString('ARCHIVE_MAX_ATTEMPTS');
        return value === undefined ? 5 : Number.parseInt(value, 10);
    },

    /**
     * @returns delay before the first retry of a failed phase; it doubles
     *   with every attempt, up to an hour
     */
    get ARCHIVE_RETRY_DELAY_SECONDS(): number {
        const value = asOptionalString('ARCHIVE_RETRY_DELAY_SECONDS');
        return value === undefined ? 60 : Number.parseFloat(value);
    },

    /**
     * @returns whether projects can be archived at all; off by default
     */
    get ARCHIVE_ENABLED(): boolean {
        return asOptionalString('ARCHIVE_ENABLED') === 'true';
    },

    /**
     * @returns path to the YAML file describing the archive storage to users
     *   (name, cost, restore instructions); see `ArchiveConfig`
     */
    get ARCHIVE_CONFIG_PATH(): string | undefined {
        return asOptionalString('ARCHIVE_CONFIG_PATH');
    },
};
