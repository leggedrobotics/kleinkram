/**
 * Raw shape of an injected environment variable.
 *
 * @quasar/app-vite v3 inlines `import.meta.env.*` values as JS literals: the
 * literals `true`, `false` and `null` as well as anything that parses as a
 * numeric literal are injected untouched, everything else as a string. v2 (via
 * Vite's own `envPrefix` handling) always injected strings, hence the helpers
 * below normalise to a string first.
 */
type RawEnvironmentValue = string | number | boolean | null | undefined;

/**
 * Widens the type of a single `import.meta.env.*` read.
 *
 * @quasar/app-vite v3 generates a precise `ImportMetaEnv` interface from the
 * .env files and process.env variables present at build time, so the same
 * variable can be typed as `true` in one environment and be absent in another.
 * Widening here keeps this module - and its type-check/lint result -
 * independent of whichever .env happens to be around.
 *
 * Note that `import.meta.env.SOME_NAME` has to stay written out literally at
 * every call site: that exact text is what the bundler substitutes.
 *
 * @param value - the raw `import.meta.env.*` read
 * @returns the same value, widened
 */
function readEnvironment(value: unknown): RawEnvironmentValue {
    return value as RawEnvironmentValue;
}

/**
 * Ensures extracted environment variable is a string
 *
 * @param value - extracted environment variable
 * @returns environment variable as string
 */
function asString(value: RawEnvironmentValue): string {
    if (value === undefined || value === null) {
        const message = 'The environment variable cannot be "undefined".';
        throw new Error(message);
    }

    return typeof value === 'string' ? value : String(value);
}

/**
 * Ensures extracted environment variable is a number
 *
 * @param value - extracted environment variable
 * @returns environment variable as integer
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function asNumber(value: RawEnvironmentValue): number {
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
function asBoolean(value: RawEnvironmentValue): boolean {
    const stringVariable = asString(value);
    if (!(stringVariable === 'true' || stringVariable === 'false')) {
        const message = `The environment variable has to hold a stringified boolean value - not ${stringVariable}`;
        throw new Error(message);
    }
    return stringVariable === 'true';
}

/**
 * Ensures extracted environment variable is one of the provided values
 *
 * @param value - extracted environment variable
 * @param valueList - list of possible values
 * @returns environment variable
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function asOneOf<T extends string | number>(value: T, valueList: T[]): T {
    if (!valueList.includes(value)) {
        const message = `The environment variable must be one of the following: ${valueList.join(
            ',',
        )} - not ${value.toString()}`;
        throw new Error(message);
    }
    return value;
}

export default {
    /**
     * @returns Url of graphql backend endpoint
     * @example http://localhost:3000/graphql
     */
    get BACKEND_URL(): string {
        return asString(
            readEnvironment(import.meta.env.BACKEND_URL) ??
                'http://localhost:3000',
        );
    },

    get VERSION(): string {
        return asString(
            readEnvironment(import.meta.env.VITE_QUASAR_VERSION) ?? '0.0.0',
        );
    },

    /**
     * @returns whether this build is a production build
     */
    get VUE_APP_PRODUCTION(): boolean {
        // @quasar/app-vite v3: Quasar build flags moved from `process.env.*`
        // to `import.meta.env.QUASAR_*` and are injected as real booleans.
        return asBoolean(readEnvironment(import.meta.env.QUASAR_PROD));
    },
    /**
     * @returns whether application is in DEV mode
     */
    get DEV(): boolean {
        return asBoolean(readEnvironment(import.meta.env.QUASAR_DEV));
    },

    get USE_FAKE_OAUTH_FOR_DEVELOPMENT(): boolean {
        return asBoolean(
            readEnvironment(
                import.meta.env.VITE_USE_FAKE_OAUTH_FOR_DEVELOPMENT,
            ) ?? 'false',
        );
    },

    get DOCS_URL(): string {
        return asString(
            readEnvironment(import.meta.env.VITE_DOCS_URL) ??
                'https://kleinkram.io/docs',
        );
    },
    get S3_ENDPOINT(): string {
        const endpoint = readEnvironment(import.meta.env.VITE_S3_ENDPOINT);
        if (endpoint !== undefined && endpoint !== null && endpoint !== '') {
            return asString(endpoint);
        }

        if (this.BACKEND_URL.includes('localhost')) {
            return asString('http://localhost:9000');
        } else {
            throw new Error('S3_ENDPOINT environment variable is missing.');
        }
    },
};
