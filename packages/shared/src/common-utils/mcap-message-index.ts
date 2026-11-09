/**
 * Address individual MCAP messages instead of whole chunks.
 *
 * An indexed MCAP reader seeks to a chunk and then reads all of it, because a
 * compressed chunk cannot be decoded in pieces. Recordings written with
 * uncompressed chunks do not have that constraint: each chunk's message index
 * gives a byte offset per message, and for an uncompressed chunk that offset
 * maps straight onto a file offset.
 *
 * That difference is large in practice. On a 2.15 GB recording whose chunks
 * average 2.4 MB and interleave a 60 kB camera topic with 200 byte telemetry,
 * reading one low-rate topic costs ~99% of the file chunk-by-chunk and ~0.8%
 * message-by-message.
 */

/** Chunk record opcode. */
export const OPCODE_CHUNK = 0x06;
/** Message record opcode. */
export const OPCODE_MESSAGE = 0x05;
/** MessageIndex record opcode. */
export const OPCODE_MESSAGE_INDEX = 0x07;

/** opcode (1) + record length (8). */
export const RECORD_HEADER_LEN = 9;

/** channel_id (2) + sequence (4) + log_time (8) + publish_time (8). */
export const MESSAGE_FIELDS_LEN = 22;

/**
 * Chunk record header excluding the variable-length compression name:
 * opcode(1) + record_length(8) + message_start_time(8) + message_end_time(8)
 * + uncompressed_size(8) + uncompressed_crc(4) + compression_length(4)
 * + records_size(8).
 */
export const CHUNK_HEADER_FIXED_LEN = 49;

export interface MessageExtent {
    /** Absolute file offset of the Message record. */
    start: number;
    /** Absolute file offset one past its last byte. */
    end: number;
    channelId: number;
    logTime: bigint;
}

export interface ByteRange {
    start: number;
    end: number;
}

export interface ParsedMessage {
    channelId: number;
    sequence: number;
    logTime: bigint;
    publishTime: bigint;
    data: Uint8Array;
}

/**
 * Where a Chunk record's message data begins, without reading its header.
 *
 * The ChunkIndex in the summary already carries the compression name, the only
 * variable part of the header, so this needs no I/O. That matters: a file can
 * hold hundreds of chunks, and a read per chunk would cost more than the
 * messages being selected.
 */
export function chunkDataStart(
    chunkStartOffset: number,
    compression: string,
): number {
    return (
        chunkStartOffset +
        CHUNK_HEADER_FIXED_LEN +
        new TextEncoder().encode(compression).length
    );
}

/**
 * Parse a chunk's MessageIndex block.
 *
 * Offsets are relative to the start of the chunk's uncompressed data.
 */
export function parseMessageIndexes(
    blob: Uint8Array,
): Map<number, { logTime: bigint; offset: number }[]> {
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    const result = new Map<number, { logTime: bigint; offset: number }[]>();

    let pos = 0;
    while (pos + RECORD_HEADER_LEN <= blob.length) {
        const opcode = blob[pos];
        const length = Number(view.getBigUint64(pos + 1, true));
        const bodyStart = pos + RECORD_HEADER_LEN;
        const bodyEnd = bodyStart + length;
        if (bodyEnd > blob.length) break;
        pos = bodyEnd;

        if (opcode !== OPCODE_MESSAGE_INDEX || length < 6) continue;

        const channelId = view.getUint16(bodyStart, true);
        const arrayLength = view.getUint32(bodyStart + 2, true);
        const entries: { logTime: bigint; offset: number }[] = [];

        let cursor = bodyStart + 6;
        const end = Math.min(cursor + arrayLength, bodyEnd);
        while (cursor + 16 <= end) {
            entries.push({
                logTime: view.getBigUint64(cursor, true),
                offset: Number(view.getBigUint64(cursor + 8, true)),
            });
            cursor += 16;
        }

        if (entries.length > 0) {
            const existing = result.get(channelId);
            if (existing) existing.push(...entries);
            else result.set(channelId, entries);
        }
    }

    return result;
}

/**
 * Work out which byte ranges of one chunk hold the wanted messages.
 *
 * Every channel's index together partitions the chunk, so a record ends where
 * the next one begins. That avoids reading a record header just to learn its
 * length.
 *
 * Only valid for uncompressed chunks; callers check `compression` first.
 */
export function planChunk(
    dataStart: number,
    uncompressedSize: number,
    indexes: Map<number, { logTime: bigint; offset: number }[]>,
    wantedChannels: Set<number> | undefined,
    startTime?: bigint,
    endTime?: bigint,
): MessageExtent[] {
    const boundaries = new Set<number>();
    for (const entries of indexes.values()) {
        for (const entry of entries) boundaries.add(entry.offset);
    }
    // Sorting a fresh copy, so the mutation the rule guards against cannot
    // reach a caller. `toSorted` is ES2023 and this package targets ES2022.
    // eslint-disable-next-line unicorn/no-array-sort
    const ordered = [...boundaries].sort((a, b) => a - b);

    const nextOffset = new Map<number, number>();
    for (let index = 0; index < ordered.length - 1; index++) {
        nextOffset.set(ordered[index], ordered[index + 1]);
    }

    const extents: MessageExtent[] = [];
    for (const [channelId, entries] of indexes) {
        if (wantedChannels && !wantedChannels.has(channelId)) continue;
        for (const { logTime, offset } of entries) {
            if (startTime !== undefined && logTime < startTime) continue;
            if (endTime !== undefined && logTime >= endTime) continue;
            extents.push({
                start: dataStart + offset,
                end: dataStart + (nextOffset.get(offset) ?? uncompressedSize),
                channelId,
                logTime,
            });
        }
    }
    return extents;
}

/**
 * Merge extents into the fewest ranges worth fetching separately.
 *
 * The gap is a bandwidth-versus-latency trade: merging across it pulls bytes
 * nobody asked for, not merging costs another round trip. Measured against
 * object storage over a WAN, total time is flat between roughly 256 kB and
 * 1 MB and worse either side, so the default sits in that basin.
 */
export function coalesce(
    extents: readonly MessageExtent[],
    gap: number,
): ByteRange[] {
    if (extents.length === 0) return [];

    // A fresh copy, as above; `extents` itself is readonly and untouched.
    // eslint-disable-next-line unicorn/no-array-sort
    const ordered = [...extents].sort((a, b) => a.start - b.start);
    const first = ordered[0];

    const ranges: ByteRange[] = [{ start: first.start, end: first.end }];
    for (const extent of ordered.slice(1)) {
        const last = ranges.at(-1);
        if (last && extent.start - last.end <= gap) {
            last.end = Math.max(last.end, extent.end);
        } else {
            ranges.push({ start: extent.start, end: extent.end });
        }
    }
    return ranges;
}

/**
 * Read one Message record out of a buffer, or undefined when the bytes at
 * `offset` are not a complete Message record.
 */
export function parseMessageRecord(
    buffer: Uint8Array,
    offset: number,
): ParsedMessage | undefined {
    if (offset + RECORD_HEADER_LEN + MESSAGE_FIELDS_LEN > buffer.length) {
        return undefined;
    }
    if (buffer[offset] !== OPCODE_MESSAGE) return undefined;

    const view = new DataView(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
    );
    const length = Number(view.getBigUint64(offset + 1, true));
    const body = offset + RECORD_HEADER_LEN;
    const dataStart = body + MESSAGE_FIELDS_LEN;
    const dataEnd = body + length;
    if (dataEnd > buffer.length) return undefined;

    return {
        channelId: view.getUint16(body, true),
        sequence: view.getUint32(body + 2, true),
        logTime: view.getBigUint64(body + 6, true),
        publishTime: view.getBigUint64(body + 14, true),
        data: buffer.subarray(dataStart, dataEnd),
    };
}
