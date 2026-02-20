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

    get DOCS_URL(): string {
        return asString('DOCS_URL');
    },

    get VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT(): boolean {
        return asBoolean('VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT');
    },

    /**
     * @returns Docker Hub namespace for image validation (optional)
     * @example rslethz/
     */
    get DOCKER_HUB_NAMESPACE(): string {
        return process.env.VITE_DOCKER_HUB_NAMESPACE ?? '';
    },
};
