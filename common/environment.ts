/**
 * Ensures extracted environment variable is a string
 *
 * @param value - extracted environment variable
 * @returns environment variable as string
 */
function asString(value: string | undefined): string {
    if (value === undefined) {
        const message = 'The environment variable cannot be "undefined".';
        throw new Error(message);
    }

    return value;
}

/**
 * Ensures extracted environment variable is a number
 *
 * @param value - extracted environment variable
 * @returns environment variable as integer
 */
function asNumber(value: string | undefined): number {
    const stringValue = asString(value);
    const numberValue = Number.parseFloat(stringValue);

    if (Number.isNaN(numberValue)) {
        const message = `The environment variable has to hold a stringified number value - not ${stringValue}`;
        throw new Error(message);
    }

    return numberValue;
}

/**
 * Ensures extracted environment variable is a boolean
 *
 * @param value - extracted environment variable
 * @returns environment variable as boolean
 */
function asBoolean(value: string | undefined): boolean {
    const stringVariable = asString(value);
    if (!(stringVariable === 'true' || stringVariable === 'false')) {
        const message = `The environment variable has to hold a stringified boolean value - not ${stringVariable}`;
        throw new Error(message);
    }
    return stringVariable === 'true';
}

export default {
    /**
     * @returns database name
     */
    get DB_DATABASE(): string {
        return asString(process.env['DB_DATABASE']);
    },
    /**
     * @returns database admin user
     */
    get DB_USER(): string {
        return asString(process.env['DB_USER']);
    },
    /**
     * @returns database admin password
     */
    get DB_PASSWORD(): string {
        return asString(process.env['DB_PASSWORD']);
    },
    /**
     * @returns database port
     */
    get DB_PORT(): number {
        return asNumber(process.env['DB_PORT']);
    },
    /**
     * @returns database host name
     * @example database
     */
    get DB_HOST(): string {
        return asString(process.env['DB_HOST']);
    },
    /**
     * @returns whether application runs in development mode
     */
    get DEV(): boolean {
        return asBoolean(process.env['DEV']);
    },

    /**
     * @returns glob describing where typeorm entities are found
     * @example dist/entities/*.entities.js
     */
    get ENTITIES(): string {
        return asString(process.env['ENTITIES']);
    },
    /**
     * @returns backend port for lambda functions
     */
    get SERVER_PORT(): number {
        return asNumber(process.env['SERVER_PORT']);
    },
    /**
     * @returns base url of frontend
     */
    get BASE_URL(): string {
        return asString(process.env['BASE_URL']);
    },

    /**
     * @returns name of project
     */
    get PROJECT_NAME(): string {
        return asString(process.env['PROJECT_NAME']);
    },

    get MINIO_ACCESS_KEY(): string {
        return asString(process.env['MINIO_ACCESS_KEY']);
    },

    get MINIO_SECRET_KEY(): string {
        return asString(process.env['MINIO_SECRET_KEY']);
    },

    get MINIO_DATA_BUCKET_NAME(): string {
        return asString(process.env['MINIO_DATA_BUCKET_NAME']);
    },
    get MINIO_DB_BUCKET_NAME(): string {
        return asString(process.env['MINIO_DB_BUCKET_NAME']);
    },
    get MINIO_ENDPOINT(): string {
        return asString(process.env['MINIO_ENDPOINT']);
    },

    get MINIO_USER(): string {
        return asString(process.env['MINIO_USER']);
    },

    get MINIO_PASSWORD(): string {
        return asString(process.env['MINIO_PASSWORD']);
    },

    get GOOGLE_CLIENT_ID(): string {
        return asString(process.env['GOOGLE_CLIENT_ID']);
    },
    get GOOGLE_CLIENT_SECRET(): string {
        return asString(process.env['GOOGLE_CLIENT_SECRET']);
    },

    get GITHUB_CLIENT_ID(): string {
        return asString(process.env['GITHUB_CLIENT_ID']);
    },

    get GITHUB_CLIENT_SECRET(): string {
        return asString(process.env['GITHUB_CLIENT_SECRET']);
    },

    get JWT_SECRET(): string {
        return asString(process.env['JWT_SECRET']);
    },

    get ENDPOINT(): string {
        return asString(process.env['QUASAR_ENDPOINT']);
    },

    get FRONTEND_URL(): string {
        return asString(process.env['FRONTEND_URL']);
    },
    get GOOGLE_KEY_FILE(): string {
        return asString(process.env['GOOGLE_KEY_FILE']);
    },

    get GOOGLE_ARTIFACT_FOLDER_ID(): string {
        return asString(process.env['GOOGLE_ARTIFACT_FOLDER_ID']);
    },

    get GOOGLE_ARTIFACT_UPLOADER_KEY_FILE(): string {
        return asString(process.env['GOOGLE_ARTIFACT_UPLOADER_KEY_FILE']);
    },

    get ARTIFACTS_UPLOADER_IMAGE(): string {
        return asString(process.env['ARTIFACTS_UPLOADER_IMAGE']);
    },

    get DOCS_URL(): string {
        return asString(process.env['DOCS_URL']);
    },

    get VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT(): boolean {
        return asBoolean(process.env['VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT']);
    },

    /**
     * @returns Docker Hub namespace for image validation (optional)
     * @example rslethz/
     */
    get DOCKER_HUB_NAMESPACE(): string {
        return process.env['VITE_DOCKER_HUB_NAMESPACE'] ?? '';
    },
};
