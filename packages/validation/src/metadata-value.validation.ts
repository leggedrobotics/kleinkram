import { DataType, safeLinkUrl } from '@kleinkram/shared';

/**
 * The rules for metadata values, shared by the frontend (shown on the field)
 * and the backend (enforced when a mission's metadata is written).
 */

/** "latitude, longitude" in decimal degrees, e.g. "47.3769, 8.5417" */
const LOCATION_REGEX = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

export const METADATA_VALUE_EXAMPLES: Partial<Record<DataType, string>> = {
    [DataType.LINK]: 'https://…',
    [DataType.LOCATION]: '47.3769, 8.5417',
};

const isValidLocation = (value: string): boolean => {
    const match = LOCATION_REGEX.exec(value);
    if (!match) return false;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
};

const isValidNumber = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    return (
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
    );
};

const isValidDate = (value: unknown): boolean =>
    typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

/**
 * The boolean a metadata value stands for: true/false, or the words in any
 * case ("True", " FALSE "), as Python's `str(True)` writes them. Undefined
 * for anything else.
 */
export const parseMetadataBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return undefined;
    const word = value.trim().toLowerCase();
    if (word === 'true') return true;
    if (word === 'false') return false;
    return undefined;
};

const isValidBoolean = (value: unknown): boolean =>
    parseMetadataBoolean(value) !== undefined;

/** Each type's check and the message shown when it fails */
const RULES: Partial<
    Record<DataType, { valid: (value: unknown) => boolean; error: string }>
> = {
    [DataType.LINK]: {
        valid: (value) => safeLinkUrl(value) !== undefined,
        error: 'Enter a full link, e.g. https://example.com/image.png',
    },
    [DataType.LOCATION]: {
        valid: (value) => typeof value === 'string' && isValidLocation(value),
        error: 'Enter latitude, longitude, e.g. 47.3769, 8.5417',
    },
    [DataType.NUMBER]: { valid: isValidNumber, error: 'Enter a number.' },
    [DataType.DATE]: {
        valid: isValidDate,
        error: 'Enter a date as YYYY-MM-DD.',
    },
    [DataType.BOOLEAN]: {
        valid: isValidBoolean,
        error: 'Choose True or False.',
    },
};

/**
 * What is wrong with a metadata value, as one short line, or undefined if
 * it is valid. Empty values are valid here: whether a value is required is
 * decided by the project.
 */
export const getMetadataValueError = (
    datatype: DataType,
    value: unknown,
): string | undefined => {
    if (value === undefined || value === null || value === '') return;
    const rule = RULES[datatype];
    if (rule === undefined || rule.valid(value)) return;
    return rule.error;
};
