from __future__ import annotations

import logging
from collections import deque
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path
from typing import Callable
from typing import Deque
from typing import Dict
from typing import Iterator
from typing import List
from typing import Optional
from typing import Sequence
from typing import Set
from typing import Tuple

import httpx

from kleinkram._version import __version__
from kleinkram.api.mcap_index import DEFAULT_COALESCE_GAP
from kleinkram.api.mcap_index import ByteRange
from kleinkram.api.mcap_index import ChunkLayout
from kleinkram.api.mcap_index import MessageExtent
from kleinkram.api.mcap_index import UnsupportedChunkEncoding
from kleinkram.api.mcap_index import chunk_data_start
from kleinkram.api.mcap_index import coalesce
from kleinkram.api.mcap_index import parse_message_indexes
from kleinkram.api.mcap_index import parse_message_record
from kleinkram.api.mcap_index import plan_chunk
from kleinkram.api.range_reader import DEFAULT_BLOCK_SIZE
from kleinkram.api.range_reader import DEFAULT_CONCURRENCY
from kleinkram.api.range_reader import HttpRangeReader

logger = logging.getLogger(__name__)

MCAP_SUFFIX = ".mcap"
# The slice is assembled under this suffix and renamed into place when complete.
PARTIAL_SUFFIX = ".part"


class McapIndexMismatch(RuntimeError):
    """The file's message index points at bytes that are not the indexed message."""


@dataclass
class McapFilterResult:
    """What a partial download actually did, for reporting and for tests."""

    messages_written: int = 0
    bytes_fetched: int = 0
    remote_size: int = 0
    requests: int = 0
    topics_written: List[str] = field(default_factory=list)
    chunks_considered: int = 0
    chunks_read: int = 0
    # True when messages were addressed individually, False when whole chunks
    # had to be pulled because they are compressed.
    indexed: bool = True

    @property
    def fetched_fraction(self) -> float:
        if self.remote_size <= 0:
            return 0.0
        return self.bytes_fetched / self.remote_size


def is_mcap(path: Path) -> bool:
    return path.suffix.lower() == MCAP_SUFFIX


def filter_mcap_from_url(
    url: str,
    dest: Path,
    *,
    topics: Optional[Sequence[str]] = None,
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    client: Optional[httpx.Client] = None,
    block_size: int = DEFAULT_BLOCK_SIZE,
    coalesce_gap: int = DEFAULT_COALESCE_GAP,
    concurrency: int = DEFAULT_CONCURRENCY,
    on_start: Optional[Callable[[int], None]] = None,
    on_progress: Optional[Callable[[int], None]] = None,
) -> McapFilterResult:
    """Write a new MCAP at `dest` holding only the selected messages of a remote MCAP.

    The remote file is read through range requests driven by its own index.

    Where chunks are stored uncompressed, individual messages are addressed
    through the per-chunk message index, so a single low-rate topic costs a
    fraction of the file rather than all of it. Compressed chunks cannot be
    addressed that way -- a chunk is the smallest decompressible unit -- so
    those fall back to reading whole chunks.

    `start_time` and `end_time` are nanoseconds since the epoch, matching MCAP
    log times. `start_time` is inclusive and `end_time` exclusive, as in
    `mcap.reader`.

    `on_start` is called with the number of bytes about to be transferred once
    that is known, and `on_progress` with each increment as it arrives.

    The output is written to a temporary file next to `dest` and moved into
    place only once complete, so a failure never leaves a truncated MCAP -- or
    destroys a file that was already at `dest`.
    """
    # Imported lazily so that `klein` starts without paying for the mcap import
    # on every invocation.
    from mcap.reader import SeekingReader

    wanted_topics = set(topics) if topics else None

    stream = HttpRangeReader(url, client=client, block_size=block_size)
    result = McapFilterResult(remote_size=stream.size)

    dest.parent.mkdir(parents=True, exist_ok=True)
    partial = dest.with_name(dest.name + PARTIAL_SUFFIX)

    try:
        reader = SeekingReader(stream)
        summary = reader.get_summary()
        header = reader.get_header()
        profile = header.profile if header is not None else ""

        extents: Optional[List[MessageExtent]] = None
        wanted_channel_ids: Optional[Set[int]] = None
        if summary is not None and summary.chunk_indexes:
            if wanted_topics is not None:
                wanted_channel_ids = {cid for cid, ch in summary.channels.items() if ch.topic in wanted_topics}
            if wanted_channel_ids is not None and not wanted_channel_ids:
                # Nothing to fetch, but still produce a valid, empty file.
                extents = []
            else:
                extents = _plan(stream, summary.chunk_indexes, wanted_channel_ids, start_time, end_time, result)

        if extents is None:
            # Compressed or unindexed: let the library read whole chunks. Only
            # an upper bound on the transfer is known up front.
            result.indexed = False
            if on_start is not None:
                on_start(stream.size)
            stream.on_fetch = on_progress
            _write_with_reader(reader, partial, profile, wanted_topics, start_time, end_time, result)
        else:
            _write_from_extents(
                stream,
                partial,
                profile,
                extents,
                summary.channels,
                summary.schemas,
                coalesce_gap,
                concurrency,
                result,
                on_start,
                on_progress,
            )
        partial.replace(dest)
    finally:
        result.bytes_fetched = stream.bytes_fetched
        result.requests = stream.requests
        stream.close()
        partial.unlink(missing_ok=True)

    logger.info(
        "partial mcap download: wrote %d messages, fetched %d of %d bytes in %d requests (indexed=%s)",
        result.messages_written,
        result.bytes_fetched,
        result.remote_size,
        result.requests,
        result.indexed,
    )
    return result


def _plan(
    stream: HttpRangeReader,
    chunk_indexes,
    wanted_channel_ids: Optional[Set[int]],
    start_time: Optional[int],
    end_time: Optional[int],
    result: McapFilterResult,
) -> Optional[List[MessageExtent]]:
    """Collect the extents of every wanted message, or None if a chunk is compressed."""
    extents: List[MessageExtent] = []

    for chunk_index in chunk_indexes:
        result.chunks_considered += 1

        if end_time is not None and chunk_index.message_start_time >= end_time:
            continue
        if start_time is not None and chunk_index.message_end_time < start_time:
            continue
        # Without message indexes the chunk's topics are unknown until it is
        # read, so it cannot be skipped -- and cannot be addressed per message.
        if not chunk_index.message_index_offsets:
            logger.info("chunk at %d has no message index, falling back to whole-chunk reads", chunk_index.chunk_start_offset)
            return None

        if wanted_channel_ids is not None and not (wanted_channel_ids & set(chunk_index.message_index_offsets)):
            continue

        if chunk_index.compression:
            logger.info("chunk is %s compressed, falling back to whole-chunk reads", chunk_index.compression)
            return None

        # The chunk header is derived rather than read: with hundreds of chunks,
        # a read per chunk would cost more than the messages themselves.
        layout = ChunkLayout(
            data_start=chunk_data_start(chunk_index.chunk_start_offset, chunk_index.compression),
            uncompressed_size=chunk_index.uncompressed_size,
            compression=chunk_index.compression,
        )

        index_start = min(chunk_index.message_index_offsets.values())
        blob = stream.read_exact(index_start, chunk_index.message_index_length)
        indexes = parse_message_indexes(blob)
        if not indexes:
            return None

        try:
            chunk_extents = plan_chunk(layout, indexes, wanted_channel_ids, start_time, end_time)
        except UnsupportedChunkEncoding:
            return None

        if chunk_extents:
            result.chunks_read += 1
            extents.extend(chunk_extents)

    return extents


def _fetch_ranges(
    stream: HttpRangeReader,
    ranges: List[ByteRange],
    concurrency: int,
) -> Iterator[Tuple[ByteRange, bytes]]:
    """Fetch byte ranges in parallel, yielding them in file order.

    Range requests against object storage are latency-bound, not
    bandwidth-bound: a selective read issues thousands of small requests, and
    done one at a time the round trips dominate everything else. Yielding in
    order keeps the writer's messages sorted by log time.

    At most `2 * concurrency` ranges are fetched ahead of the consumer, so
    memory stays bounded no matter how many ranges the selection produced.
    """
    ordered = sorted(ranges, key=lambda r: r.start)

    if concurrency <= 1 or len(ordered) <= 1:
        for byte_range in ordered:
            yield byte_range, stream.read_exact(byte_range.start, byte_range.length)
        return

    with ThreadPoolExecutor(max_workers=concurrency) as pool:
        pending: Deque[Tuple[ByteRange, Future[bytes]]] = deque()
        upcoming = iter(ordered)

        def submit_next() -> None:
            byte_range = next(upcoming, None)
            if byte_range is not None:
                pending.append(
                    (
                        byte_range,
                        pool.submit(
                            stream.read_exact,
                            byte_range.start,
                            byte_range.length,
                        ),
                    )
                )

        for _ in range(concurrency * 2):
            submit_next()

        while pending:
            byte_range, future = pending.popleft()
            yield byte_range, future.result()
            submit_next()


def _write_from_extents(
    stream: HttpRangeReader,
    dest: Path,
    profile: str,
    extents: List[MessageExtent],
    channels,
    schemas,
    coalesce_gap: int,
    concurrency: int,
    result: McapFilterResult,
    on_start: Optional[Callable[[int], None]] = None,
    on_progress: Optional[Callable[[int], None]] = None,
) -> None:
    schema_ids: Dict[int, int] = {}
    channel_ids: Dict[int, int] = {}
    written_topics: Dict[str, None] = {}

    ordered = sorted(extents, key=lambda e: e.start)
    ranges = coalesce(ordered, gap=coalesce_gap)
    if on_start is not None:
        on_start(sum(r.length for r in ranges))

    with dest.open("wb") as handle:
        writer = Writer_factory(handle)
        writer.start(profile=profile, library=f"kleinkram {__version__}")

        # Ranges and extents are both in file order, and every extent lies in
        # exactly one range, so a single cursor pairs them up. (Filtering all
        # extents per range is quadratic, and a busy topic has tens of
        # thousands of each.)
        cursor = 0
        for byte_range, buffer in _fetch_ranges(stream, ranges, concurrency):
            if on_progress is not None:
                on_progress(len(buffer))

            first = cursor
            while cursor < len(ordered) and ordered[cursor].start < byte_range.end:
                cursor += 1

            for extent in ordered[first:cursor]:
                parsed = parse_message_record(buffer, extent.start - byte_range.start)
                # The index said a message of this channel and time starts here.
                # If the record disagrees, the offsets are wrong, and carrying on
                # would quietly write an incomplete file.
                if parsed is None or parsed[0] != extent.channel_id or parsed[2] != extent.log_time:
                    raise McapIndexMismatch(
                        f"no message record for channel {extent.channel_id} at offset {extent.start}, "
                        "where the file's message index points"
                    )
                channel_id, sequence, log_time, publish_time, data = parsed

                channel = channels.get(channel_id)
                if channel is None:
                    continue

                if channel_id not in channel_ids:
                    schema = schemas.get(channel.schema_id)
                    if schema is not None and schema.id not in schema_ids:
                        schema_ids[schema.id] = writer.register_schema(
                            name=schema.name,
                            encoding=schema.encoding,
                            data=schema.data,
                        )
                    channel_ids[channel_id] = writer.register_channel(
                        topic=channel.topic,
                        message_encoding=channel.message_encoding,
                        schema_id=schema_ids.get(channel.schema_id, 0),
                        metadata=channel.metadata,
                    )
                    written_topics[channel.topic] = None

                writer.add_message(
                    channel_id=channel_ids[channel_id],
                    log_time=log_time,
                    data=data,
                    publish_time=publish_time,
                    sequence=sequence,
                )
                result.messages_written += 1

        writer.finish()

    result.topics_written = list(written_topics)


def Writer_factory(handle):  # noqa: N802 - thin indirection to keep the import lazy
    from mcap.writer import Writer

    return Writer(handle)


def _write_with_reader(
    reader,
    dest: Path,
    profile: str,
    wanted_topics: Optional[Set[str]],
    start_time: Optional[int],
    end_time: Optional[int],
    result: McapFilterResult,
) -> None:
    """Whole-chunk fallback, used when chunks are compressed or unindexed."""
    schema_ids: Dict[int, int] = {}
    channel_ids: Dict[int, int] = {}
    written_topics: Dict[str, None] = {}

    with dest.open("wb") as handle:
        writer = Writer_factory(handle)
        writer.start(profile=profile, library=f"kleinkram {__version__}")

        for schema, channel, message in reader.iter_messages(
            topics=list(wanted_topics) if wanted_topics else None,
            start_time=start_time,
            end_time=end_time,
        ):
            if schema is not None and schema.id not in schema_ids:
                schema_ids[schema.id] = writer.register_schema(
                    name=schema.name,
                    encoding=schema.encoding,
                    data=schema.data,
                )
            if channel.id not in channel_ids:
                channel_ids[channel.id] = writer.register_channel(
                    topic=channel.topic,
                    message_encoding=channel.message_encoding,
                    schema_id=schema_ids.get(channel.schema_id, 0),
                    metadata=channel.metadata,
                )
                written_topics[channel.topic] = None

            writer.add_message(
                channel_id=channel_ids[channel.id],
                log_time=message.log_time,
                data=message.data,
                publish_time=message.publish_time,
                sequence=message.sequence,
            )
            result.messages_written += 1

        writer.finish()

    result.topics_written = list(written_topics)
