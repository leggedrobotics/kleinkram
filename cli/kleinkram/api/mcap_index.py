from __future__ import annotations

import logging
import struct
from dataclasses import dataclass
from dataclasses import field
from typing import Dict
from typing import Iterable
from typing import List
from typing import Optional
from typing import Sequence
from typing import Tuple

logger = logging.getLogger(__name__)


OPCODE_CHUNK = 0x06
OPCODE_MESSAGE = 0x05
OPCODE_MESSAGE_INDEX = 0x07

RECORD_HEADER_LEN = 9  # opcode (1) + record length (8)

# Message record: channel_id (2) + sequence (4) + log_time (8) + publish_time (8)
MESSAGE_FIELDS_LEN = 22

# Two runs closer than this are fetched as one request, trading bytes for round
# trips. Measured on a 2.15 GB production recording (/rosout, 8 in flight):
# 4 KB -> 16.4 MB in 76 s, 16 KB -> 19.3 MB in 59 s, 64 KB -> 38.9 MB in 58 s.
DEFAULT_COALESCE_GAP = 16 * 1024


class UnsupportedChunkEncoding(RuntimeError):
    """A chunk is compressed, so individual messages cannot be addressed in it."""


@dataclass(frozen=True)
class MessageExtent:
    """Where one message record lives in the file, and what it is."""

    start: int
    end: int
    channel_id: int
    log_time: int


@dataclass
class ByteRange:
    start: int
    end: int

    @property
    def length(self) -> int:
        return self.end - self.start


@dataclass
class ChunkLayout:
    """The part of a Chunk record's header needed to address its messages."""

    data_start: int
    uncompressed_size: int
    compression: str

    @property
    def data_end(self) -> int:
        return self.data_start + self.uncompressed_size


@dataclass
class IndexPlan:
    """The byte ranges to fetch, and the messages found in them."""

    extents: List[MessageExtent] = field(default_factory=list)
    ranges: List[ByteRange] = field(default_factory=list)

    @property
    def bytes_planned(self) -> int:
        return sum(r.length for r in self.ranges)


# Chunk record header, excluding the variable-length compression name:
#   opcode(1) + record_length(8)
#   + message_start_time(8) + message_end_time(8) + uncompressed_size(8)
#   + uncompressed_crc(4) + compression_length(4) + records_size(8)
CHUNK_HEADER_FIXED_LEN = 49


def chunk_data_start(chunk_start_offset: int, compression: str) -> int:
    """Where a Chunk record's message data begins, without reading the header.

    The ChunkIndex in the summary already carries the compression name, which is
    the only variable part of the header, so this needs no I/O. Avoiding a read
    here matters: a file can hold hundreds of chunks, and reading a header from
    each would otherwise dominate the transfer.
    """
    return chunk_start_offset + CHUNK_HEADER_FIXED_LEN + len(compression.encode("utf-8"))


def read_chunk_layout(stream, chunk_start_offset: int) -> ChunkLayout:
    """Parse a Chunk record header to find where its message data begins.

    The header is variable length because it carries the compression name
    inline, so the data offset has to be read rather than assumed.
    """
    stream.seek(chunk_start_offset)
    header = stream.read(128)
    if len(header) < RECORD_HEADER_LEN + 32:
        raise ValueError(f"truncated chunk header at {chunk_start_offset}")

    opcode = header[0]
    if opcode != OPCODE_CHUNK:
        raise ValueError(f"expected a Chunk record at {chunk_start_offset}, found opcode 0x{opcode:02x}")

    pos = RECORD_HEADER_LEN
    pos += 24  # message_start_time, message_end_time, uncompressed_size
    (uncompressed_size,) = struct.unpack_from("<Q", header, RECORD_HEADER_LEN + 16)
    pos += 4  # uncompressed_crc
    (compression_len,) = struct.unpack_from("<I", header, pos)
    pos += 4
    compression_end = pos + compression_len
    compression = header[pos:compression_end].decode("utf-8")
    pos += compression_len
    pos += 8  # records_size

    return ChunkLayout(
        data_start=chunk_start_offset + pos,
        uncompressed_size=uncompressed_size,
        compression=compression,
    )


def parse_message_indexes(blob: bytes) -> Dict[int, List[Tuple[int, int]]]:
    """Parse a chunk's MessageIndex block into channel id -> [(log_time, offset)].

    Offsets are relative to the start of the chunk's uncompressed data.
    """
    result: Dict[int, List[Tuple[int, int]]] = {}
    pos = 0
    while pos + RECORD_HEADER_LEN <= len(blob):
        opcode = blob[pos]
        (length,) = struct.unpack_from("<Q", blob, pos + 1)
        body_start = pos + RECORD_HEADER_LEN
        body_end = body_start + length
        if body_end > len(blob):
            break
        pos = body_end

        if opcode != OPCODE_MESSAGE_INDEX or length < 6:
            continue

        (channel_id,) = struct.unpack_from("<H", blob, body_start)
        (array_len,) = struct.unpack_from("<I", blob, body_start + 2)
        cursor = body_start + 6
        end = min(cursor + array_len, body_end)
        entries: List[Tuple[int, int]] = []
        while cursor + 16 <= end:
            log_time, offset = struct.unpack_from("<QQ", blob, cursor)
            entries.append((log_time, offset))
            cursor += 16
        if entries:
            result.setdefault(channel_id, []).extend(entries)
    return result


def plan_chunk(
    layout: ChunkLayout,
    indexes: Dict[int, List[Tuple[int, int]]],
    wanted_channels: Optional[Iterable[int]],
    start_time: Optional[int],
    end_time: Optional[int],
) -> List[MessageExtent]:
    """Work out exactly which byte ranges of one chunk hold the wanted messages.

    Every channel's index together partitions the chunk, so the end of a record
    is the start of the next one in file order. That avoids reading a record
    header just to learn its length.
    """
    if layout.compression:
        raise UnsupportedChunkEncoding(layout.compression)

    boundaries = sorted({offset for entries in indexes.values() for _log_time, offset in entries})
    next_offset = {offset: boundaries[i + 1] for i, offset in enumerate(boundaries[:-1])}

    wanted = set(wanted_channels) if wanted_channels is not None else set(indexes)

    extents: List[MessageExtent] = []
    for channel_id, entries in indexes.items():
        if channel_id not in wanted:
            continue
        for log_time, offset in entries:
            if start_time is not None and log_time < start_time:
                continue
            if end_time is not None and log_time >= end_time:
                continue
            end = next_offset.get(offset, layout.uncompressed_size)
            extents.append(
                MessageExtent(
                    start=layout.data_start + offset,
                    end=layout.data_start + end,
                    channel_id=channel_id,
                    log_time=log_time,
                )
            )
    return extents


def coalesce(extents: Sequence[MessageExtent], gap: int = DEFAULT_COALESCE_GAP) -> List[ByteRange]:
    """Merge message extents into the fewest ranges worth fetching separately."""
    if not extents:
        return []

    ordered = sorted(extents, key=lambda e: e.start)
    ranges = [ByteRange(ordered[0].start, ordered[0].end)]
    for extent in ordered[1:]:
        last = ranges[-1]
        if extent.start - last.end <= gap:
            last.end = max(last.end, extent.end)
        else:
            ranges.append(ByteRange(extent.start, extent.end))
    return ranges


def parse_message_record(buffer: bytes, offset: int) -> Optional[Tuple[int, int, int, int, bytes]]:
    """Read one Message record, returning (channel_id, sequence, log_time, publish_time, data)."""
    if offset + RECORD_HEADER_LEN + MESSAGE_FIELDS_LEN > len(buffer):
        return None
    opcode = buffer[offset]
    if opcode != OPCODE_MESSAGE:
        return None
    (length,) = struct.unpack_from("<Q", buffer, offset + 1)
    body = offset + RECORD_HEADER_LEN
    channel_id, sequence, log_time, publish_time = struct.unpack_from("<HIQQ", buffer, body)
    data_start = body + MESSAGE_FIELDS_LEN
    data_end = body + length
    if data_end > len(buffer):
        return None
    return channel_id, sequence, log_time, publish_time, buffer[data_start:data_end]
