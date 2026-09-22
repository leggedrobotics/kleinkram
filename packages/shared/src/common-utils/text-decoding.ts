/**
 * Decoding rules for the plain-text file types Kleinkram accepts.
 *
 * Ingestion deliberately accepts single-byte encodings (spreadsheets still
 * export latin-1 CSVs) alongside UTF-8, so every consumer has to apply the same
 * rule — otherwise the browser renders replacement characters for a file the
 * server considered healthy.
 */

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** The longest UTF-8 sequence, so at most this many trailing bytes can be cut. */
const MAX_UTF8_SEQUENCE_TAIL = 3;

const startsWithBom = (bytes: Uint8Array): boolean =>
    bytes.length >= UTF8_BOM.length &&
    UTF8_BOM.every((byte, index) => bytes[index] === byte);

const isContinuationByte = (byte: number): boolean => (byte & 0xc0) === 0x80;

/** How many bytes the UTF-8 sequence starting at `byte` spans, 0 if it is not a lead byte. */
const sequenceLength = (byte: number): number => {
    if (byte >= 0xf0) return 4;
    if (byte >= 0xe0) return 3;
    if (byte >= 0xc0) return 2;
    return 0;
};

/**
 * Number of trailing bytes that form a multi-byte character the sample cut in
 * half. Returns 0 when the bytes end on a complete character.
 */
const incompleteTailLength = (bytes: Uint8Array): number => {
    const maxTail = Math.min(MAX_UTF8_SEQUENCE_TAIL, bytes.length);
    for (let fromEnd = 1; fromEnd <= maxTail; fromEnd++) {
        const byte = bytes[bytes.length - fromEnd];
        if (isContinuationByte(byte)) continue;
        return sequenceLength(byte) > fromEnd ? fromEnd : 0;
    }
    return 0;
};

/**
 * Decodes bytes as UTF-8, stripping a leading BOM.
 *
 * @param truncated - Set when `bytes` is only the leading slice of a larger
 * file. A trailing byte such as `0xe9` is then read as a character the slice cut
 * short and dropped; without the flag it is (correctly) treated as invalid
 * UTF-8, which is what makes a complete latin-1 file fall back rather than lose
 * its last character.
 * @returns the decoded text, or `undefined` if the bytes are not valid UTF-8.
 */
export const decodeUtf8Sample = (
    bytes: Uint8Array,
    truncated = false,
): string | undefined => {
    const body = startsWithBom(bytes) ? bytes.subarray(UTF8_BOM.length) : bytes;
    const end = body.length - (truncated ? incompleteTailLength(body) : 0);

    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(
            body.subarray(0, end),
        );
    } catch {
        return undefined;
    }
};

/**
 * Decodes bytes using the same rule ingestion validates against: UTF-8 when the
 * bytes are valid UTF-8, otherwise windows-1252, the single-byte encoding that
 * legacy exports use.
 */
export const decodeTextSample = (
    bytes: Uint8Array,
    truncated = false,
): string =>
    decodeUtf8Sample(bytes, truncated) ??
    new TextDecoder('windows-1252').decode(bytes);
