from __future__ import annotations

import io
import logging
import struct
from dataclasses import dataclass
from dataclasses import field
from typing import Dict
from typing import List
from typing import Optional
from typing import Tuple

import httpx

from kleinkram.api.mcap_filter import fetch_ranges
from kleinkram.api.mcap_index import ByteRange
from kleinkram.api.range_reader import DEFAULT_CONCURRENCY
from kleinkram.api.range_reader import HttpRangeReader

logger = logging.getLogger(__name__)

MCAP_MAGIC = b"\x89MCAP0\r\n"

# opcode, record length, then summary_start, summary_offset_start and the
# summary crc. The footer is the last record, followed only by the magic.
_FOOTER = struct.Struct("<BQQQI")
_FOOTER_OPCODE = 0x02
_TAIL_SIZE = _FOOTER.size + len(MCAP_MAGIC)

# magic, opcode, record length: where the header record's content starts.
_HEADER_PREFIX = struct.Struct("<8sBQ")
_HEADER_OPCODE = 0x01
# A header holds two short strings (profile and writing library); this covers
# it in one request for every recorder we have seen.
_HEADER_GUESS = 4096


class McapSummaryUnavailable(RuntimeError):
    """The remote file has no summary section to read, or is not an MCAP at all."""


@dataclass(frozen=True)
class McapTopic:
    name: str
    message_type: str
    message_encoding: str
    # None when the recorder wrote no statistics record.
    message_count: Optional[int] = None
    # Mean rate over the whole recording, in Hz. None for fewer than two messages.
    frequency: Optional[float] = None


@dataclass(frozen=True)
class McapSchema:
    name: str
    encoding: str
    # None for binary schemas (protobuf, flatbuffer), which have no text form.
    definition: Optional[str] = None


@dataclass(frozen=True)
class McapAttachment:
    name: str
    media_type: str
    size: int
    log_time: int


@dataclass(frozen=True)
class McapMetadata:
    name: str
    # None when only the index was read; the record itself costs a request.
    values: Optional[Dict[str, str]] = None


@dataclass(frozen=True)
class McapInfo:
    """What an MCAP says about itself, read without transferring its messages.

    Times are nanoseconds since the epoch, as MCAP log times and as
    `kleinkram.download(start_time=..., end_time=...)` take them.
    """

    profile: str
    library: str
    message_count: Optional[int]
    start_time: Optional[int]
    end_time: Optional[int]
    chunk_count: int
    # Chunk count per compression; uncompressed chunks are filed under "none".
    compression: Dict[str, int]
    compressed_size: int
    uncompressed_size: int
    # True when every chunk carries a per-message index.
    message_indexed: bool
    topics: List[McapTopic] = field(default_factory=list)
    schemas: List[McapSchema] = field(default_factory=list)
    attachments: List[McapAttachment] = field(default_factory=list)
    metadata: List[McapMetadata] = field(default_factory=list)
    file_size: int = 0
    bytes_fetched: int = 0
    requests: int = 0

    @property
    def duration(self) -> Optional[float]:
        """Seconds between the first and the last message."""
        if self.start_time is None or self.end_time is None:
            return None
        return (self.end_time - self.start_time) / 1e9

    @property
    def latest_metadata(self) -> Dict[str, McapMetadata]:
        """The last metadata record of each name.

        A record cannot be changed once written, so a writer that wants to
        update one appends another under the same name. rosbag2 does exactly
        that: a placeholder when it opens the file, the real values when it
        closes it. `metadata` keeps every record, in file order.
        """
        return {record.name: record for record in self.metadata}

    @property
    def per_message_access(self) -> bool:
        """Whether a partial download can fetch single messages.

        It can when chunks are uncompressed and indexed. Otherwise a slice pulls
        whole chunks, and a topic filter without a time window transfers most of
        the file.
        """
        return self.chunk_count > 0 and self.message_indexed and set(self.compression) == {"none"}


def read_mcap_info_from_url(
    url: str,
    *,
    metadata: bool = False,
    client: Optional[httpx.Client] = None,
    concurrency: int = DEFAULT_CONCURRENCY,
) -> McapInfo:
    """Read the header and summary section of a remote MCAP through range requests.

    Three requests, whatever the size of the recording: the footer, which says
    where the summary starts, the summary itself, and the header. `metadata`
    adds one request per metadata record, since the summary only indexes them.
    """
    # Imported lazily so that `klein` starts without paying for the mcap import
    # on every invocation.
    from mcap.records import AttachmentIndex
    from mcap.records import Channel
    from mcap.records import ChunkIndex
    from mcap.records import Footer
    from mcap.records import MetadataIndex
    from mcap.records import Schema
    from mcap.records import Statistics
    from mcap.stream_reader import StreamReader

    stream = HttpRangeReader(url, client=client)
    try:
        summary_start = _read_summary_start(stream)
        blob = stream.read_exact(summary_start, stream.size - summary_start)

        statistics: Optional[Statistics] = None
        schemas: Dict[int, Schema] = {}
        channels: Dict[int, Channel] = {}
        chunk_indexes: List[ChunkIndex] = []
        attachment_indexes: List[AttachmentIndex] = []
        metadata_indexes: List[MetadataIndex] = []
        for record in StreamReader(io.BytesIO(blob), skip_magic=True).records:
            if isinstance(record, Statistics):
                statistics = record
            elif isinstance(record, Schema):
                schemas[record.id] = record
            elif isinstance(record, Channel):
                channels[record.id] = record
            elif isinstance(record, ChunkIndex):
                chunk_indexes.append(record)
            elif isinstance(record, AttachmentIndex):
                attachment_indexes.append(record)
            elif isinstance(record, MetadataIndex):
                metadata_indexes.append(record)
            elif isinstance(record, Footer):
                break

        profile, library = _read_header(stream)
        start_time, end_time = _time_range(statistics, chunk_indexes)

        compression: Dict[str, int] = {}
        for chunk_index in chunk_indexes:
            name = chunk_index.compression or "none"
            compression[name] = compression.get(name, 0) + 1

        if metadata:
            metadata_records = _read_metadata(stream, metadata_indexes, concurrency)
        else:
            metadata_records = [McapMetadata(name=index.name) for index in metadata_indexes]

        return McapInfo(
            profile=profile,
            library=library,
            message_count=statistics.message_count if statistics is not None else None,
            start_time=start_time,
            end_time=end_time,
            chunk_count=len(chunk_indexes),
            compression=compression,
            compressed_size=sum(c.compressed_size for c in chunk_indexes),
            uncompressed_size=sum(c.uncompressed_size for c in chunk_indexes),
            message_indexed=bool(chunk_indexes) and all(c.message_index_offsets for c in chunk_indexes),
            topics=_topics(channels, schemas, statistics, start_time, end_time),
            schemas=[_schema(schema) for schema in sorted(schemas.values(), key=lambda s: s.name)],
            attachments=[
                McapAttachment(name=a.name, media_type=a.media_type, size=a.data_size, log_time=a.log_time)
                for a in attachment_indexes
            ],
            metadata=metadata_records,
            file_size=stream.size,
            bytes_fetched=stream.bytes_fetched,
            requests=stream.requests,
        )
    finally:
        stream.close()


def _read_summary_start(stream: HttpRangeReader) -> int:
    if stream.size < _TAIL_SIZE + len(MCAP_MAGIC):
        raise McapSummaryUnavailable("the file is too small to be an MCAP")

    tail = stream.read_exact(stream.size - _TAIL_SIZE, _TAIL_SIZE)
    opcode, _length, summary_start, _summary_offset_start, _crc = _FOOTER.unpack_from(tail)
    if not tail.endswith(MCAP_MAGIC) or opcode != _FOOTER_OPCODE:
        raise McapSummaryUnavailable(
            "the file does not end in an MCAP footer; it is not an MCAP, or the recording was cut off before it was closed"
        )
    if summary_start == 0:
        raise McapSummaryUnavailable("the file has no summary section, so nothing can be read without downloading it")
    if summary_start >= stream.size - _TAIL_SIZE:
        raise McapSummaryUnavailable("the footer points at a summary section outside the file")
    return int(summary_start)


def _read_header(stream: HttpRangeReader) -> Tuple[str, str]:
    from mcap.records import Header
    from mcap.stream_reader import StreamReader

    blob = stream.read_exact(0, min(stream.size, _HEADER_GUESS))
    magic, opcode, length = _HEADER_PREFIX.unpack_from(blob)
    if magic != MCAP_MAGIC or opcode != _HEADER_OPCODE:
        raise McapSummaryUnavailable("the file does not start with an MCAP header")

    end = _HEADER_PREFIX.size + length
    if end > len(blob):
        blob = stream.read_exact(0, end)

    record = next(StreamReader(io.BytesIO(blob[:end])).records)
    if not isinstance(record, Header):  # pragma: no cover - the opcode was checked above
        raise McapSummaryUnavailable("the file does not start with an MCAP header")
    return record.profile, record.library


def _time_range(statistics, chunk_indexes) -> Tuple[Optional[int], Optional[int]]:
    if statistics is not None and statistics.message_count > 0:
        return statistics.message_start_time, statistics.message_end_time
    if chunk_indexes:
        return min(c.message_start_time for c in chunk_indexes), max(c.message_end_time for c in chunk_indexes)
    return None, None


def _topics(channels, schemas, statistics, start_time: Optional[int], end_time: Optional[int]) -> List[McapTopic]:
    seconds = (end_time - start_time) / 1e9 if start_time is not None and end_time is not None else 0.0

    # A topic can be recorded on several channels (one per publisher), so
    # their counts are added up.
    counts: Dict[Tuple[str, str, str], Optional[int]] = {}
    for channel_id, channel in channels.items():
        schema = schemas.get(channel.schema_id)
        key = (channel.topic, schema.name if schema is not None else "", channel.message_encoding)
        if statistics is None:
            counts[key] = None
        else:
            counts[key] = (counts.get(key) or 0) + statistics.channel_message_counts.get(channel_id, 0)

    return [
        McapTopic(
            name=name,
            message_type=message_type,
            message_encoding=message_encoding,
            message_count=count,
            frequency=_frequency(count, seconds),
        )
        for (name, message_type, message_encoding), count in sorted(counts.items())
    ]


def _frequency(count: Optional[int], seconds: float) -> Optional[float]:
    # The summary has no per-topic time range, so this is the count over the
    # length of the whole recording, as `mcap info` reports it. One message
    # has no rate.
    if count is None or count < 2 or seconds <= 0:
        return None
    return count / seconds


def _schema(schema) -> McapSchema:
    try:
        definition: Optional[str] = schema.data.decode("utf-8")
    except UnicodeDecodeError:
        definition = None
    return McapSchema(name=schema.name, encoding=schema.encoding, definition=definition)


def _read_metadata(stream: HttpRangeReader, metadata_indexes, concurrency: int) -> List[McapMetadata]:
    from mcap.records import Metadata
    from mcap.stream_reader import StreamReader

    ranges = [ByteRange(index.offset, index.offset + index.length) for index in metadata_indexes]

    records: List[McapMetadata] = []
    for byte_range, blob in fetch_ranges(stream, ranges, concurrency):
        record = next(StreamReader(io.BytesIO(blob), skip_magic=True).records)
        if not isinstance(record, Metadata):
            raise McapSummaryUnavailable(
                f"no metadata record at offset {byte_range.start}, where the file's metadata index points"
            )
        records.append(McapMetadata(name=record.name, values=dict(record.metadata)))
    return records
