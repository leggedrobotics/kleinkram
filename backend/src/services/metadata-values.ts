import { MetadataEntity } from '@kleinkram/backend-common/entities/metadata/metadata.entity';
import { DataType, safeLinkUrl } from '@kleinkram/shared';

/** The value columns of a metadata row, as set from a client value. */
export type MetadataValueColumns = Pick<
    MetadataEntity,
    | 'value_string'
    | 'value_number'
    | 'value_boolean'
    | 'value_date'
    | 'value_location'
>;

export type ParsedMetadataValue =
    | { ok: true; columns: Partial<MetadataValueColumns> }
    | { ok: false; error: string };

const fail = (name: string, expectation: string): ParsedMetadataValue => ({
    ok: false,
    error: `Metadata "${name}" must be ${expectation}`,
});

// `Number`, not `parseInt`: the column is a double, so 1.5 stays 1.5, and
// `abc` must be rejected instead of stored as NaN
const parseNumber = (name: string, value: unknown): ParsedMetadataValue => {
    const text = typeof value === 'string' ? value.trim() : undefined;
    const number = typeof value === 'number' ? value : Number(text ?? NaN);
    if (text === '' || !Number.isFinite(number)) return fail(name, 'a number');
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { ok: true, columns: { value_number: number } };
};

const parseBoolean = (name: string, value: unknown): ParsedMetadataValue => {
    const lower =
        typeof value === 'string' ? value.trim().toLowerCase() : undefined;
    const bool =
        typeof value === 'boolean'
            ? value
            : lower === 'true' || (lower === 'false' ? false : undefined);
    if (bool === undefined) return fail(name, 'true or false');
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { ok: true, columns: { value_boolean: bool } };
};

/**
 * ISO 8601 date, optionally with a time and a zone: `2024-05-13`,
 * `2024-05-13T10:30`, `2024-05-13T10:30:00.000Z`, `2024-05-13T10:30+02:00`.
 */
const ISO_DATE =
    /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

const parseDate = (name: string, value: unknown): ParsedMetadataValue => {
    const text = typeof value === 'string' ? value.trim() : '';
    // rules out formats `new Date` would also read, like `05/13/2024`
    const match = ISO_DATE.exec(text);
    if (!match) return fail(name, 'a date like 2024-05-13');

    // `new Date` rolls `2024-02-30` over into March: the calendar date must
    // come back unchanged
    const [year, month, day] = [match[1], match[2], match[3]].map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    const date = new Date(text);
    if (
        Number.isNaN(date.getTime()) ||
        calendar.getUTCFullYear() !== year ||
        calendar.getUTCMonth() !== month - 1 ||
        calendar.getUTCDate() !== day
    ) {
        return fail(name, 'a date like 2024-05-13');
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { ok: true, columns: { value_date: date } };
};

/**
 * Converts a client value (JSON from the UI, the CLI or a metadata file) to
 * the column of its metadata type, or explains what the value should look
 * like. Values Postgres can't store (e.g. `abc` for a NUMBER or `13.05.2024`
 * for a DATE) must be rejected here, before anything is written.
 */
export const parseMetadataValue = (
    name: string,
    datatype: DataType,
    value: unknown,
): ParsedMetadataValue => {
    switch (datatype) {
        case DataType.NUMBER: {
            return parseNumber(name, value);
        }
        case DataType.BOOLEAN: {
            return parseBoolean(name, value);
        }
        case DataType.DATE: {
            return parseDate(name, value);
        }
        case DataType.STRING: {
            if (typeof value !== 'string') return fail(name, 'text');
            // eslint-disable-next-line @typescript-eslint/naming-convention
            return { ok: true, columns: { value_string: value } };
        }
        case DataType.LINK: {
            // the frontend opens links on click: a `javascript:` URL would
            // run in the viewer's session
            if (typeof value !== 'string' || safeLinkUrl(value) === undefined) {
                return fail(name, 'an absolute http:// or https:// URL');
            }
            // eslint-disable-next-line @typescript-eslint/naming-convention
            return { ok: true, columns: { value_string: value } };
        }
        case DataType.LOCATION: {
            if (typeof value !== 'string') return fail(name, 'text');
            // eslint-disable-next-line @typescript-eslint/naming-convention
            return { ok: true, columns: { value_location: value } };
        }
        default: {
            return {
                ok: false,
                error: `Metadata "${name}" has a type that can't hold values`,
            };
        }
    }
};
