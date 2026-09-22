/**
 * Content checks for the plain-text file types Kleinkram accepts.
 *
 * These formats have no magic number, so the best we can do is reject anything
 * that clearly is not the format: binary payloads renamed to `.md` / `.csv`,
 * and (for CSV) text without a consistent delimited structure.
 */

import { decodeTextSample, decodeUtf8Sample } from '@kleinkram/shared';

/** Number of leading bytes inspected; enough to judge a file without reading it all. */
export const TEXT_SAMPLE_BYTES = 8192;

/** Delimiters we recognise, in the order they are preferred on a tie. */
const CSV_DELIMITERS = [',', ';', '\t'] as const;

/** C0 control bytes that legitimately occur in text files. */
const ALLOWED_CONTROL_BYTES = new Set([0x09, 0x0a, 0x0c, 0x0d]);

/**
 * True when the sample looks like human-readable text rather than a binary
 * payload that was given a text extension.
 *
 * Text files are expected to be UTF-8, but legacy exports in a single-byte
 * encoding such as latin-1 are still accepted: those decode as invalid UTF-8
 * yet stay far below the share of high bytes that binary data produces.
 */
export const isPlainTextSample = (
    sample: Buffer,
    sampleIsCompleteFile: boolean,
): boolean => {
    if (sample.length === 0) return false;
    if (sample.includes(0)) return false;

    let controlBytes = 0;
    let highBytes = 0;
    for (const byte of sample) {
        if (byte < 0x20 && !ALLOWED_CONTROL_BYTES.has(byte)) controlBytes++;
        else if (byte >= 0x80) highBytes++;
    }
    if (controlBytes > sample.length * 0.01) return false;

    if (decodeUtf8Sample(sample, !sampleIsCompleteFile) !== undefined)
        return true;
    return highBytes <= sample.length * 0.1;
};

/**
 * Splits CSV text into the field counts of each record, honouring quoted fields
 * (which may contain the delimiter, newlines, and `""` escapes).
 *
 * The final record is dropped unless `sampleIsCompleteFile`, because a sample
 * cut mid-file almost always ends in a partial row.
 */
const recordFieldCounts = (
    text: string,
    delimiter: string,
    sampleIsCompleteFile: boolean,
): number[] => {
    const counts: number[] = [];
    let fields = 1;
    let inQuotes = false;
    let recordHasContent = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];

        if (inQuotes) {
            if (character !== '"') continue;
            if (text[index + 1] === '"') {
                index++; // escaped quote inside a quoted field
                continue;
            }
            inQuotes = false;
            continue;
        }

        if (character === delimiter) {
            fields++;
            recordHasContent = true;
            continue;
        }

        switch (character) {
            case '"': {
                inQuotes = true;
                recordHasContent = true;
                break;
            }
            case '\n': {
                if (recordHasContent) counts.push(fields);
                fields = 1;
                recordHasContent = false;
                break;
            }
            case '\r': {
                break;
            }
            default: {
                recordHasContent = true;
            }
        }
    }

    if (sampleIsCompleteFile && !inQuotes && recordHasContent) {
        counts.push(fields);
    }

    return counts;
};

/** Share of records that must agree on a field count for a file to look tabular. */
const CSV_CONSISTENCY_THRESHOLD = 0.5;

/** The most common field count in `counts`, and the share of records having it. */
const dominantFieldCount = (
    counts: number[],
): { fields: number; share: number } => {
    const frequency = new Map<number, number>();
    for (const count of counts)
        frequency.set(count, (frequency.get(count) ?? 0) + 1);

    let fields = 0;
    let occurrences = 0;
    for (const [count, seen] of frequency) {
        // On a tie the wider shape is the more plausible table.
        if (seen > occurrences || (seen === occurrences && count > fields)) {
            fields = count;
            occurrences = seen;
        }
    }
    return { fields, share: occurrences / counts.length };
};

/**
 * True when the text is plausibly a delimited table.
 *
 * The bar is deliberately low. Real exports are messy — a comment banner above
 * the header, a row with a trailing field omitted, a single column — and CSV has
 * no spec that forbids any of it. Marking such a file CORRUPTED costs the user
 * their upload, while letting an odd file through only makes its preview look
 * strange, so only content with no tabular shape at all is rejected. Binary
 * payloads are caught by `isPlainTextSample` before this runs.
 */
export const looksLikeCsv = (
    sample: Buffer,
    sampleIsCompleteFile: boolean,
): boolean => {
    const text = decodeTextSample(sample, !sampleIsCompleteFile);

    // A single record can be longer than the sample (a header with hundreds of
    // columns, say), leaving nothing complete to judge. Record boundaries do not
    // depend on the delimiter, so one probe settles it for all of them. Absence
    // of evidence is not evidence of corruption.
    const [firstDelimiter] = CSV_DELIMITERS;
    if (
        recordFieldCounts(text, firstDelimiter, sampleIsCompleteFile).length ===
        0
    )
        return true;

    let anyDelimiterSplitsRows = false;
    for (const delimiter of CSV_DELIMITERS) {
        const counts = recordFieldCounts(text, delimiter, sampleIsCompleteFile);
        const { fields, share } = dominantFieldCount(counts);
        if (fields > 1) anyDelimiterSplitsRows = true;
        if (fields > 1 && share >= CSV_CONSISTENCY_THRESHOLD) return true;
    }

    // No delimiter splits the rows at all: that is a single-column list, which
    // is a valid CSV and indistinguishable from one, so it is accepted.
    return !anyDelimiterSplitsRows;
};
