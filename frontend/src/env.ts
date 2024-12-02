import * as process from 'process';

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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function asNumber(value: string | undefined): number {
    const stringValue = asString(value);
    const numberValue = parseFloat(stringValue);

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
    const strVar = asString(value);
    if (!(strVar === 'true' || strVar === 'false')) {
        const message = `The environment variable has to hold a stringified boolean value - not ${strVar}`;
        throw new Error(message);
    }
    return strVar === 'true';
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
    get ENDPOINT(): string {
        return asString(
            import.meta.env.VITE_QUASAR_ENDPOINT || 'http://localhost:3000',
        );
    },

    get VERSION(): string {
        return asString(import.meta.env.VITE_QUASAR_VERSION || '0.0.0');
    },

    /**
     * @returns whether this build is a production build
     */
    get VUE_APP_PRODUCTION(): boolean {
        return asBoolean(process.env.VUE_APP_PRODUCTION);
    },
    /**
     * @returns whether application is in DEV mode
     */
    get DEV(): boolean {
        return asBoolean(process.env.DEV);
    },
};
