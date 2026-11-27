/**
 * Reader for NovAtel OEM7 receiver logs, the `.LOG` files a NovAtel receiver
 * (PwrPak7, SMART7, OEM7 cards with SPAN) writes to its internal storage.
 *
 * Such a file is a plain concatenation of messages in up to four framings:
 *
 * - binary, long header: `AA 44 12`, header length, then the header and body,
 *   followed by a CRC-32
 * - binary, short header: `AA 44 13`, body length, a 12 byte header, the body
 *   and a CRC-32 (used for high rate logs such as RAWIMUSX)
 * - ASCII: `#NAME,header;body*crc32hex` on one line
 * - abbreviated ASCII: `<NAME ...` lines without a checksum, written for
 *   command responses such as the RXCONFIG dump at the start of a log
 *
 * There is no file header or magic number, so a file is recognised by finding
 * frames whose CRC matches. Random data or a text log practically never
 * produces one, let alone several in a row.
 *
 * Reference: NovAtel OEM7 Commands and Logs Reference Manual,
 * https://docs.novatel.com/OEM7/Content/Messages/Messages.htm
 *
 * The reader works on byte windows, so a preview can scan a slice from the
 * middle of a multi-gigabyte file: anything before the first sync is skipped.
 */

export type NovatelFraming = 'binary' | 'shortBinary' | 'ascii' | 'abbreviated';

/** One message located in a byte window. */
export interface NovatelFrame {
    framing: NovatelFraming;
    /** Message ID, undefined for (abbreviated) ASCII frames. */
    id?: number;
    name: string;
    /** GPS week, 0 or undefined when the receiver had no time yet. */
    week?: number;
    /** Milliseconds into the GPS week. */
    milliseconds?: number;
    /** Time status from the long header (e.g. 180 = FINESTEERING). */
    timeStatus?: number;
    /** Offset and length of the message body inside the window. */
    bodyOffset: number;
    bodyLength: number;
}

const SYNC_0 = 0xaa;
const SYNC_1 = 0x44;
const SYNC_LONG = 0x12;
const SYNC_SHORT = 0x13;
const ASCII_SYNC = 0x23; // '#'
const ABBREVIATED_SYNC = 0x3c; // '<'
const NEWLINE = 0x0a;

const LONG_HEADER_MIN_LENGTH = 28;
const SHORT_HEADER_LENGTH = 12;
const CRC_LENGTH = 4;
/** An ASCII message longer than this is not one, the scan moves on. */
const ASCII_MAX_LENGTH = 16_384;

const CRC_TABLE = ((): Uint32Array => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
        let crc = index;
        for (let bit = 0; bit < 8; bit++) {
            crc = crc & 1 ? (crc >>> 1) ^ 0xed_b8_83_20 : crc >>> 1;
        }
        table[index] = crc >>> 0;
    }
    return table;
})();

/**
 * NovAtel's CRC-32: the reflected 0xEDB88320 polynomial like zlib, but starting
 * from 0 and without the final inversion.
 */
export const novatelCrc32 = (
    bytes: Uint8Array,
    start = 0,
    end = bytes.length,
): number => {
    let crc = 0;
    for (let index = start; index < end; index++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        crc = CRC_TABLE[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
    }
    return crc >>> 0;
};

/**
 * Names of the messages a SPAN/GNSS log usually holds. IDs that are not listed
 * show up as `ID 1234` in the preview.
 */
export const NOVATEL_MESSAGE_NAMES: ReadonlyMap<number, string> = new Map([
    [5, 'LOGLIST'],
    [7, 'GPSEPHEM'],
    [8, 'IONUTC'],
    [37, 'VERSION'],
    [41, 'RAWEPHEM'],
    [42, 'BESTPOS'],
    [43, 'RANGE'],
    [47, 'PSRPOS'],
    [83, 'TRACKSTAT'],
    [93, 'RXSTATUS'],
    [94, 'RXSTATUSEVENT'],
    [99, 'BESTVEL'],
    [101, 'TIME'],
    [128, 'RXCONFIG'],
    [140, 'RANGECMP'],
    [241, 'BESTXYZ'],
    [263, 'INSATT'],
    [265, 'INSPOS'],
    [268, 'RAWIMU'],
    [325, 'RAWIMUS'],
    [507, 'INSPVA'],
    [508, 'INSPVAS'],
    [723, 'GLOEPHEMERIS'],
    [726, 'BESTUTM'],
    [812, 'CORRIMUDATA'],
    [813, 'CORRIMUDATAS'],
    [971, 'HEADING'],
    [1163, 'PSRDOP2'],
    [1309, 'GALINAVEPHEMERIS'],
    [1310, 'GALFNAVEPHEMERIS'],
    [1335, 'HEADING2'],
    [1336, 'QZSSEPHEMERIS'],
    [1429, 'BESTGNSSPOS'],
    [1430, 'BESTGNSSVEL'],
    [1461, 'RAWIMUX'],
    [1462, 'RAWIMUSX'],
    [1465, 'INSPVAX'],
    [1538, 'PPPPOS'],
    [1696, 'BDSEPHEMERIS'],
    [1825, 'INSUPDATESTATUS'],
    [1945, 'INSCONFIG'],
    [2051, 'INSSTDEV'],
]);

export const novatelMessageName = (id: number): string =>
    NOVATEL_MESSAGE_NAMES.get(id) ?? `ID ${String(id)}`;

/** Position or solution type, as in BESTPOS and INSPVAX. */
export const NOVATEL_POSITION_TYPES: ReadonlyMap<number, string> = new Map([
    [0, 'NONE'],
    [1, 'FIXEDPOS'],
    [2, 'FIXEDHEIGHT'],
    [8, 'DOPPLER_VELOCITY'],
    [16, 'SINGLE'],
    [17, 'PSRDIFF'],
    [18, 'WAAS'],
    [19, 'PROPAGATED'],
    [32, 'L1_FLOAT'],
    [34, 'NARROW_FLOAT'],
    [48, 'L1_INT'],
    [49, 'WIDE_INT'],
    [50, 'NARROW_INT'],
    [51, 'RTK_DIRECT_INS'],
    [52, 'INS_SBAS'],
    [53, 'INS_PSRSP'],
    [54, 'INS_PSRDIFF'],
    [55, 'INS_RTKFLOAT'],
    [56, 'INS_RTKFIXED'],
    [68, 'PPP_CONVERGING'],
    [69, 'PPP'],
    [70, 'OPERATIONAL'],
    [71, 'WARNING'],
    [72, 'OUT_OF_BOUNDS'],
    [73, 'INS_PPP_CONVERGING'],
    [74, 'INS_PPP'],
    [77, 'PPP_BASIC_CONVERGING'],
    [78, 'PPP_BASIC'],
    [79, 'INS_PPP_BASIC_CONVERGING'],
    [80, 'INS_PPP_BASIC'],
]);

/** INS solution status, as in INSPVAX. */
export const NOVATEL_INS_STATUS: ReadonlyMap<number, string> = new Map([
    [0, 'INS_INACTIVE'],
    [1, 'INS_ALIGNING'],
    [2, 'INS_HIGH_VARIANCE'],
    [3, 'INS_SOLUTION_GOOD'],
    [6, 'INS_SOLUTION_FREE'],
    [7, 'INS_ALIGNMENT_COMPLETE'],
    [8, 'DETERMINING_ORIENTATION'],
    [9, 'WAITING_INITIALPOS'],
    [10, 'WAITING_AZIMUTH'],
    [11, 'INITIALIZING_BIASES'],
    [12, 'MOTION_DETECT'],
    [14, 'WAITING_ALIGNMENTORIENTATION'],
]);

/**
 * Time status below COARSE (100) means the receiver did not know GPS time yet;
 * such stamps count from power-on and must not set the recording span.
 */
const MIN_TIME_STATUS = 100;

const readUint16 = (bytes: Uint8Array, at: number): number =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    bytes[at]! | (bytes[at + 1]! << 8);

const readUint32 = (bytes: Uint8Array, at: number): number =>
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (bytes[at]! | (bytes[at + 1]! << 8) | (bytes[at + 2]! << 16)) +
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    bytes[at + 3]! * 0x1_00_00_00;

const isHexDigit = (byte: number): boolean =>
    (byte >= 0x30 && byte <= 0x39) ||
    (byte >= 0x41 && byte <= 0x46) ||
    (byte >= 0x61 && byte <= 0x66);

const asciiText = (bytes: Uint8Array, start: number, end: number): string => {
    let text = '';
    for (let index = start; index < end; index++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        text += String.fromCodePoint(bytes[index]!);
    }
    return text;
};

/** Result of trying to read one frame at an offset. */
type FrameAttempt =
    | { frame: NovatelFrame; next: number }
    /**
     * Not a frame, or one the window ends inside of (its CRC cannot be
     * checked); scanning resumes one byte further.
     */
    | { frame: undefined; next: undefined };

const NOT_A_FRAME = { frame: undefined, next: undefined } as const;

const readBinary = (bytes: Uint8Array, at: number): FrameAttempt => {
    if (at + LONG_HEADER_MIN_LENGTH > bytes.length) return NOT_A_FRAME;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const headerLength = bytes[at + 3]!;
    if (headerLength < LONG_HEADER_MIN_LENGTH) return NOT_A_FRAME;
    const bodyLength = readUint16(bytes, at + 8);
    const end = at + headerLength + bodyLength;
    if (end + CRC_LENGTH > bytes.length) return NOT_A_FRAME;
    if (novatelCrc32(bytes, at, end) !== readUint32(bytes, end))
        return NOT_A_FRAME;
    const id = readUint16(bytes, at + 4);
    return {
        frame: {
            framing: 'binary',
            id,
            name: novatelMessageName(id),
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            timeStatus: bytes[at + 13]!,
            week: readUint16(bytes, at + 14),
            milliseconds: readUint32(bytes, at + 16),
            bodyOffset: at + headerLength,
            bodyLength,
        },
        next: end + CRC_LENGTH,
    };
};

const readShortBinary = (bytes: Uint8Array, at: number): FrameAttempt => {
    if (at + SHORT_HEADER_LENGTH > bytes.length) return NOT_A_FRAME;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const bodyLength = bytes[at + 3]!;
    const end = at + SHORT_HEADER_LENGTH + bodyLength;
    if (end + CRC_LENGTH > bytes.length) return NOT_A_FRAME;
    if (novatelCrc32(bytes, at, end) !== readUint32(bytes, end))
        return NOT_A_FRAME;
    const id = readUint16(bytes, at + 4);
    return {
        frame: {
            framing: 'shortBinary',
            id,
            name: novatelMessageName(id),
            week: readUint16(bytes, at + 6),
            milliseconds: readUint32(bytes, at + 8),
            bodyOffset: at + SHORT_HEADER_LENGTH,
            bodyLength,
        },
        next: end + CRC_LENGTH,
    };
};

/**
 * Remembers the end of the last search so the many failed candidates in a
 * window (every `#` or `<` byte inside binary data) do not each scan ahead
 * again: a lookup from inside an already searched stretch reuses its result.
 * Keeps a scan linear in the window size.
 */
interface SearchMemo {
    from: number;
    /** First match at or after `from`, -1 when there is none. */
    found: number;
}

interface ScanContext {
    bytes: Uint8Array;
    /** End of an ASCII message: `*`, or any byte that cannot be part of one. */
    asciiEnd: SearchMemo;
    newline: SearchMemo;
}

const createContext = (bytes: Uint8Array): ScanContext => ({
    bytes,
    asciiEnd: { from: -1, found: -1 },
    newline: { from: -1, found: -1 },
});

const memoSearch = (
    memo: SearchMemo,
    bytes: Uint8Array,
    start: number,
    matches: (byte: number) => boolean,
): number => {
    const covered =
        memo.from !== -1 &&
        start >= memo.from &&
        (memo.found === -1 || start <= memo.found);
    if (!covered) {
        memo.from = start;
        memo.found = -1;
        for (let index = start; index < bytes.length; index++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (matches(bytes[index]!)) {
                memo.found = index;
                break;
            }
        }
    }
    return memo.found;
};

const ASTERISK = 0x2a;
const isAsciiEnd = (byte: number): boolean =>
    byte === ASTERISK || byte < 0x20 || byte > 0x7e;
const isNewline = (byte: number): boolean => byte === NEWLINE;

/** Message names are uppercase letters, digits and `_`, then a comma. */
const MAX_NAME_LENGTH = 40;
const hasAsciiName = (bytes: Uint8Array, at: number): boolean => {
    const limit = Math.min(bytes.length, at + 1 + MAX_NAME_LENGTH + 1);
    for (let index = at + 1; index < limit; index++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const byte = bytes[index]!;
        if (byte === 0x2c) return index > at + 1;
        const valid =
            (byte >= 0x41 && byte <= 0x5a) ||
            (byte >= 0x30 && byte <= 0x39) ||
            byte === 0x5f;
        if (!valid) return false;
    }
    return false;
};

/** `#NAMEA,port,seq,idle,timestatus,week,seconds,...;body*xxxxxxxx` */
const readAscii = (context: ScanContext, at: number): FrameAttempt => {
    const { bytes } = context;
    if (!hasAsciiName(bytes, at)) return NOT_A_FRAME;
    const star = memoSearch(context.asciiEnd, bytes, at + 1, isAsciiEnd);
    if (star === -1) return NOT_A_FRAME;
    if (bytes[star] !== ASTERISK || star - at > ASCII_MAX_LENGTH)
        return NOT_A_FRAME;
    if (star + 9 > bytes.length) return NOT_A_FRAME;
    for (let index = star + 1; index < star + 9; index++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (!isHexDigit(bytes[index]!)) return NOT_A_FRAME;
    }
    const expected = Number.parseInt(asciiText(bytes, star + 1, star + 9), 16);
    if (novatelCrc32(bytes, at + 1, star) !== expected) return NOT_A_FRAME;

    const semicolon = bytes.subarray(at, star).indexOf(0x3b);
    const headerEnd = semicolon === -1 ? star : at + semicolon;
    const fields = asciiText(bytes, at + 1, headerEnd).split(',');
    const name = (fields[0] ?? '').replace(/A$/, '');
    const week = Number(fields[5]);
    const seconds = Number(fields[6]);
    const statusName = fields[4] ?? '';

    let next = star + 9;
    while (bytes[next] === 0x0d || bytes[next] === NEWLINE) next++;
    return {
        frame: {
            framing: 'ascii',
            name,
            week: Number.isFinite(week) ? week : undefined,
            milliseconds: Number.isFinite(seconds)
                ? Math.round(seconds * 1000)
                : undefined,
            timeStatus: ASCII_TIME_STATUS.get(statusName),
            bodyOffset: headerEnd + 1,
            bodyLength: Math.max(0, star - headerEnd - 1),
        },
        next,
    };
};

const ASCII_TIME_STATUS: ReadonlyMap<string, number> = new Map([
    ['UNKNOWN', 20],
    ['APPROXIMATE', 60],
    ['COARSEADJUSTING', 80],
    ['COARSE', 100],
    ['COARSESTEERING', 120],
    ['FREEWHEELING', 130],
    ['FINEADJUSTING', 140],
    ['FINE', 160],
    ['FINEBACKUPSTEERING', 170],
    ['FINESTEERING', 180],
    ['SATTIME', 200],
]);

/**
 * `<NAME port seq ...` response header line. Its continuation lines start with
 * `<` and spaces and belong to the message above, so only the header counts.
 * There is no checksum, so this framing is only trusted between other frames.
 */
const readAbbreviated = (context: ScanContext, at: number): FrameAttempt => {
    const { bytes } = context;
    const newline = memoSearch(context.newline, bytes, at, isNewline);
    if (newline === -1) return NOT_A_FRAME;
    if (newline - at > ASCII_MAX_LENGTH) return NOT_A_FRAME;
    const line = asciiText(bytes, at + 1, newline).replace(/\r$/, '');
    const match = /^([A-Z][A-Z0-9_]*)(?:\s|$)/.exec(line);
    // A continuation (`<     ...`) has no name; it is skipped as a whole line.
    return {
        frame: {
            framing: 'abbreviated',
            name: match?.[1] ?? '',
            bodyOffset: at + 1,
            bodyLength: newline - at - 1,
        },
        next: newline + 1,
    };
};

const readFrameAt = (context: ScanContext, at: number): FrameAttempt => {
    const { bytes } = context;
    const first = bytes[at];
    if (first === SYNC_0) {
        if (at + 3 > bytes.length) return NOT_A_FRAME;
        if (bytes[at + 1] !== SYNC_1) return NOT_A_FRAME;
        if (bytes[at + 2] === SYNC_LONG) return readBinary(bytes, at);
        if (bytes[at + 2] === SYNC_SHORT) return readShortBinary(bytes, at);
        return NOT_A_FRAME;
    }
    if (first === ASCII_SYNC) return readAscii(context, at);
    if (first === ABBREVIATED_SYNC) return readAbbreviated(context, at);
    return NOT_A_FRAME;
};

export interface NovatelScanResult {
    frames: NovatelFrame[];
    /** Frames whose integrity is backed by a CRC (all but abbreviated ASCII). */
    checkedFrames: number;
    /** Bytes that belonged to no frame. */
    skippedBytes: number;
    /** Offset after the last frame found; anything after it was cut off. */
    endOffset: number;
}

/**
 * Splits a byte window into frames. Bytes that are not part of a valid frame
 * are skipped up to the next candidate sync, so a window starting mid-message
 * still yields everything after its first complete frame.
 */
export const scanNovatelFrames = (bytes: Uint8Array): NovatelScanResult => {
    const context = createContext(bytes);
    const frames: NovatelFrame[] = [];
    let checkedFrames = 0;
    let skippedBytes = 0;
    let at = 0;
    let endOffset = 0;
    // Abbreviated lines have no checksum: inside binary data a stray `<` would
    // read as one. Trust them only once a checked frame has anchored the scan.
    let anchored = false;

    while (at < bytes.length) {
        const first = bytes[at];
        const attempt =
            first === ABBREVIATED_SYNC && !anchored
                ? NOT_A_FRAME
                : readFrameAt(context, at);
        // An unverified candidate, including one whose claimed length runs
        // past the window, is just a byte: sync patterns occur inside bodies,
        // and valid frames may follow it.
        if (attempt.frame === undefined) {
            skippedBytes++;
            at++;
            if (first !== ABBREVIATED_SYNC) anchored = false;
            continue;
        }
        if (attempt.frame.framing === 'abbreviated') {
            if (attempt.frame.name !== '') frames.push(attempt.frame);
        } else {
            frames.push(attempt.frame);
            checkedFrames++;
            anchored = true;
        }
        at = attempt.next;
        endOffset = at;
    }
    return { frames, checkedFrames, skippedBytes, endOffset };
};

/** CRC-checked frames a sample must contain to count as a NovAtel log. */
const MIN_CHECKED_FRAMES = 2;

/**
 * True when the bytes are the start (or any slice) of a NovAtel log: at least
 * two frames whose CRC matches. Used by ingestion to tell a receiver log from a
 * text log and by the preview to pick a viewer.
 */
export const isNovatelLog = (sample: Uint8Array): boolean => {
    const context = createContext(sample);
    let checked = 0;
    let at = 0;
    while (at < sample.length) {
        const first = sample[at];
        if (first !== SYNC_0 && first !== ASCII_SYNC) {
            at++;
            continue;
        }
        const attempt = readFrameAt(context, at);
        if (attempt.frame === undefined) {
            at++;
            continue;
        }
        checked++;
        if (checked >= MIN_CHECKED_FRAMES) return true;
        at = attempt.next;
    }
    return false;
};

/** True when a frame's GPS time can be placed on the calendar. */
export const hasValidGpsTime = (frame: NovatelFrame): boolean =>
    frame.week !== undefined &&
    frame.week > 0 &&
    frame.milliseconds !== undefined &&
    // Short headers carry no time status; their stamps are always GPS time.
    (frame.timeStatus === undefined || frame.timeStatus >= MIN_TIME_STATUS);

const GPS_EPOCH_MS = Date.UTC(1980, 0, 6);
const WEEK_MS = 7 * 24 * 3600 * 1000;
/**
 * GPS runs ahead of UTC by the leap seconds since 1980: 18 since 2017-01-01.
 * The receiver logs the current offset in TIME, but a preview of a slice may
 * not contain one, and no leap second has been added since.
 */
const GPS_UTC_OFFSET_MS = 18_000;

/** Unix time in milliseconds (UTC) for a GPS week and time of week. */
export const gpsToUnixMs = (week: number, milliseconds: number): number =>
    GPS_EPOCH_MS + week * WEEK_MS + milliseconds - GPS_UTC_OFFSET_MS;

const view = (bytes: Uint8Array): DataView =>
    new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

export interface NovatelPosition {
    /** Unix time in milliseconds, undefined without valid GPS time. */
    time?: number;
    lat: number;
    lon: number;
    height: number;
    /** Position type, e.g. INS_PPP or NARROW_INT. */
    positionType: string;
    /** INS status for INS solutions, e.g. INS_SOLUTION_GOOD. */
    insStatus?: string;
    /** 1-sigma horizontal error in metres, when the message reports it. */
    horizontalSigma?: number;
    /** Satellites used in the solution (BESTPOS family). */
    satellites?: number;
}

const enumName = (table: ReadonlyMap<number, string>, value: number): string =>
    table.get(value) ?? String(value);

/** False for a solution without a fix, which would pull a track to 0/0. */
const hasFix = (position: NovatelPosition): boolean =>
    position.positionType !== 'NONE' &&
    Number.isFinite(position.lat) &&
    Number.isFinite(position.lon) &&
    Math.abs(position.lat) <= 90 &&
    Math.abs(position.lon) <= 180 &&
    !(position.lat === 0 && position.lon === 0);

const BESTPOS_LIKE = new Set([42, 47, 1429, 1538]); // BESTPOS, PSRPOS, BESTGNSSPOS, PPPPOS
const INSPVAX_ID = 1465;
const INSPVA_IDS = new Set([507, 508]); // INSPVA, INSPVAS

const BESTPOS_LIKE_NAMES = new Set([
    'BESTPOS',
    'PSRPOS',
    'BESTGNSSPOS',
    'PPPPOS',
]);

const frameTime = (frame: NovatelFrame): number | undefined =>
    hasValidGpsTime(frame)
        ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          gpsToUnixMs(frame.week!, frame.milliseconds!)
        : undefined;

/** Comma separated fields of an ASCII message body, quotes removed. */
const asciiFields = (bytes: Uint8Array, frame: NovatelFrame): string[] =>
    asciiText(bytes, frame.bodyOffset, frame.bodyOffset + frame.bodyLength)
        .split(',')
        .map((field) => field.replaceAll('"', '').trim());

const decodeAsciiPosition = (
    bytes: Uint8Array,
    frame: NovatelFrame,
): NovatelPosition | undefined => {
    const fields = asciiFields(bytes, frame);
    const number = (index: number): number => Number(fields[index]);
    const time = frameTime(frame);
    if (BESTPOS_LIKE_NAMES.has(frame.name) && fields.length >= 15) {
        if (fields[0] !== 'SOL_COMPUTED') return;
        return {
            time,
            positionType: fields[1] ?? '',
            lat: number(2),
            lon: number(3),
            height: number(4),
            horizontalSigma: Math.hypot(number(7), number(8)),
            satellites: number(14),
        };
    }
    if (frame.name === 'INSPVAX' && fields.length >= 14) {
        return {
            time,
            insStatus: fields[0],
            positionType: fields[1] ?? '',
            lat: number(2),
            lon: number(3),
            height: number(4),
            horizontalSigma: Math.hypot(number(12), number(13)),
        };
    }
    if (frame.name === 'INSPVA' && fields.length >= 12) {
        return {
            time,
            insStatus: fields[11],
            positionType: 'INS',
            lat: number(2),
            lon: number(3),
            height: number(4),
        };
    }
    return undefined;
};

const decodeBinaryPosition = (
    bytes: Uint8Array,
    frame: NovatelFrame,
): NovatelPosition | undefined => {
    if (frame.id === undefined) return;
    const body = view(bytes);
    const at = frame.bodyOffset;
    const time = frameTime(frame);

    let position: NovatelPosition | undefined;
    if (BESTPOS_LIKE.has(frame.id) && frame.bodyLength >= 66) {
        const solutionStatus = body.getUint32(at, true);
        if (solutionStatus !== 0) return; // SOL_COMPUTED only
        const latSigma = body.getFloat32(at + 40, true);
        const lonSigma = body.getFloat32(at + 44, true);
        position = {
            time,
            positionType: enumName(
                NOVATEL_POSITION_TYPES,
                body.getUint32(at + 4, true),
            ),
            lat: body.getFloat64(at + 8, true),
            lon: body.getFloat64(at + 16, true),
            height: body.getFloat64(at + 24, true),
            horizontalSigma: Math.hypot(latSigma, lonSigma),
            satellites: body.getUint8(at + 65),
        };
    } else if (frame.id === INSPVAX_ID && frame.bodyLength >= 96) {
        const latSigma = body.getFloat32(at + 84, true);
        const lonSigma = body.getFloat32(at + 88, true);
        position = {
            time,
            insStatus: enumName(NOVATEL_INS_STATUS, body.getUint32(at, true)),
            positionType: enumName(
                NOVATEL_POSITION_TYPES,
                body.getUint32(at + 4, true),
            ),
            lat: body.getFloat64(at + 8, true),
            lon: body.getFloat64(at + 16, true),
            height: body.getFloat64(at + 24, true),
            horizontalSigma: Math.hypot(latSigma, lonSigma),
        };
    } else if (
        INSPVA_IDS.has(frame.id) &&
        frame.bodyLength >= 88 &&
        frame.bodyLength <= 92
    ) {
        position = {
            time,
            insStatus: enumName(
                NOVATEL_INS_STATUS,
                body.getUint32(at + 84, true),
            ),
            positionType: 'INS',
            lat: body.getFloat64(at + 12, true),
            lon: body.getFloat64(at + 20, true),
            height: body.getFloat64(at + 28, true),
        };
    }
    return position;
};

/**
 * The position in a binary or ASCII frame, for the message types that carry
 * one, or undefined. Frames without a fix (position type NONE or 0/0
 * coordinates) are dropped so they do not pull the track to the equator.
 */
export const decodeNovatelPosition = (
    bytes: Uint8Array,
    frame: NovatelFrame,
): (NovatelPosition & { source: string }) | undefined => {
    let position: NovatelPosition | undefined;
    if (frame.framing === 'ascii') position = decodeAsciiPosition(bytes, frame);
    else if (frame.framing !== 'abbreviated')
        position = decodeBinaryPosition(bytes, frame);
    if (!position || !hasFix(position)) return;
    return { ...position, source: frame.name };
};

export interface NovatelReceiver {
    /** Hardware, e.g. `OEM7720-1.01`. */
    hardware: string;
    /** Model code, the enabled options, e.g. `MFDRYNTBEP1`. */
    model: string;
    serial: string;
    firmware: string;
}

/** Model, serial number and firmware from the first component of VERSION. */
export const decodeNovatelVersion = (
    bytes: Uint8Array,
    frame: NovatelFrame,
): NovatelReceiver | undefined => {
    if (frame.framing === 'ascii' && frame.name === 'VERSION') {
        // #comp,type,"model","psn","hw version","sw version",...
        const fields = asciiFields(bytes, frame);
        if (fields.length < 6) return;
        return {
            model: fields[2] ?? '',
            serial: fields[3] ?? '',
            hardware: fields[4] ?? '',
            firmware: fields[5] ?? '',
        };
    }
    if (frame.id !== 37 || frame.framing !== 'binary') return;
    // #comp (4), then per component: type (4), model (16), psn (16),
    // hw version (16), sw version (16), boot version (16), date (12), time (12)
    if (frame.bodyLength < 4 + 4 + 5 * 16) return;
    const text = (offset: number, length: number): string => {
        const start = frame.bodyOffset + offset;
        let end = start;
        while (end < start + length && bytes[end] !== 0) end++;
        return asciiText(bytes, start, end).trim();
    };
    return {
        model: text(8, 16),
        serial: text(24, 16),
        hardware: text(40, 16),
        firmware: text(56, 16),
    };
};
