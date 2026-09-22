/**
 * Content checks for the plain-text file types Kleinkram accepts.
 *
 * These formats have no magic number, so the best we can do is reject anything
 * that clearly is not the format: binary payloads renamed to `.md` / `.csv`,
 * and (for CSV) text without a consistent delimited structure.
 */

/** Number of leading bytes inspected; enough to judge a file without reading it all. */
export const TEXT_SAMPLE_BYTES = 8192;

const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** Delimiters we recognise, in the order they are preferred on a tie. */
const CSV_DELIMITERS = [',', ';', '\t'] as const;

/**
 * Decodes a prefix of a UTF-8 file. The sample may cut a multi-byte character
 * in half, so up to three trailing bytes are dropped before giving up.
 *
 * @returns the decoded text, or `undefined` if the sample is not valid UTF-8.
 */
export const decodeUtf8Sample = (sample: Buffer): string | undefined => {
    const withoutBom = sample.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)
        ? sample.subarray(UTF8_BOM.length)
        : sample;

    const decoder = new TextDecoder('utf-8', { fatal: true });
    for (let dropped = 0; dropped <= 3; dropped++) {
        const end = withoutBom.length - dropped;
        if (end < 0) break;
        try {
            return decoder.decode(withoutBom.subarray(0, end));
        } catch {
            // truncated multi-byte sequence at the end of the sample, retry shorter
        }
    }
    return undefined;
};

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
export const isPlainTextSample = (sample: Buffer): boolean => {
    if (sample.length === 0) return false;
    if (sample.includes(0)) return false;

    let controlBytes = 0;
    let highBytes = 0;
    for (const byte of sample) {
        if (byte < 0x20 && !ALLOWED_CONTROL_BYTES.has(byte)) controlBytes++;
        else if (byte >= 0x80) highBytes++;
    }
    if (controlBytes > sample.length * 0.01) return false;

    if (decodeUtf8Sample(sample) !== undefined) return true;
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

/**
 * True when the text parses as a delimited table: every record has the same
 * number of fields, and there is more than one field per record.
 */
export const looksLikeCsv = (
    text: string,
    sampleIsCompleteFile: boolean,
): boolean =>
    CSV_DELIMITERS.some((delimiter) => {
        const counts = recordFieldCounts(text, delimiter, sampleIsCompleteFile);
        if (counts.length === 0) return false;

        const [fieldCount] = counts;
        if (fieldCount < 2) return false;
        return counts.every((count) => count === fieldCount);
    });
