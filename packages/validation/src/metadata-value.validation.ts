import { DataType, safeLinkUrl } from '@kleinkram/shared';

/**
 * The rules for metadata values, shared by the frontend (shown on the field)
 * and the backend (enforced when a mission's metadata is written).
 */

export const METADATA_VALUE_EXAMPLES: Partial<Record<DataType, string>> = {
    [DataType.LINK]: 'https://…',
};

const isValidNumber = (value: unknown): boolean => {
    if (typeof value === 'number') return Number.isFinite(value);
    return (
        typeof value === 'string' &&
        value.trim() !== '' &&
        Number.isFinite(Number(value))
    );
};

/**
 * ISO 8601 date, optionally with a time and a zone: `2024-05-13`,
 * `2024-05-13T10:30`, `2024-05-13T10:30:00.000Z`, `2024-05-13 10:30+02:00`.
 */
const ISO_DATE =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const isValidDate = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    const text = value.trim();
    const match = ISO_DATE.exec(text);
    if (!match || Number.isNaN(new Date(text).getTime())) return false;
    // `new Date` rolls 2024-02-30 over into March: the calendar date must
    // come back unchanged
    const [year, month, day] = [match[1], match[2], match[3]].map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    return (
        calendar.getUTCFullYear() === year &&
        calendar.getUTCMonth() === month - 1 &&
        calendar.getUTCDate() === day
    );
};

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
