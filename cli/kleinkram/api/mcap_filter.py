from __future__ import annotations

import logging
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence

import httpx

from kleinkram._version import __version__
from kleinkram.api.range_reader import DEFAULT_BLOCK_SIZE
from kleinkram.api.range_reader import HttpRangeReader

logger = logging.getLogger(__name__)

MCAP_SUFFIX = ".mcap"


@dataclass
class McapFilterResult:
    """What a partial download actually did, for reporting and for tests."""

    messages_written: int = 0
    bytes_fetched: int = 0
    remote_size: int = 0
    requests: int = 0
    topics_written: List[str] = field(default_factory=list)

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
) -> McapFilterResult:
    """Write a new MCAP at `dest` holding only the selected messages of a remote MCAP.

    The remote file is read through range requests driven by its own index, so
    only the chunks overlapping the selection are transferred.

    `start_time` and `end_time` are nanoseconds since the epoch, matching MCAP
    log times. `end_time` is exclusive, as in `McapReader.iter_messages`.

    A caveat worth knowing before relying on this: MCAP chunks usually interleave
    topics, and a chunk is the smallest unit that can be fetched and
    decompressed. Narrowing by `topics` therefore shrinks the *output* file but
    rarely the transfer; narrowing by time is what saves bandwidth, because
    chunks are ordered by log time.
    """
    # Imported lazily so that `klein` starts without paying for the mcap import
    # on every invocation.
    from mcap.reader import SeekingReader
    from mcap.writer import Writer

    topic_list = list(topics) if topics else None

    reader_stream = HttpRangeReader(url, client=client, block_size=block_size)
    result = McapFilterResult(remote_size=reader_stream.size)

    schema_ids: Dict[int, int] = {}
    channel_ids: Dict[int, int] = {}
    written_topics: Dict[str, None] = {}

    dest.parent.mkdir(parents=True, exist_ok=True)

    try:
        reader = SeekingReader(reader_stream)

        # Carry the source profile through so the slice stays readable by the
        # same tooling as the original (ros2, etc.).
        header = reader.get_header()
        profile = header.profile if header is not None else ""

        with dest.open("wb") as handle:
            writer = Writer(handle)
            writer.start(profile=profile, library=f"kleinkram {__version__}")

            for schema, channel, message in reader.iter_messages(
                topics=topic_list,
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
    finally:
        result.bytes_fetched = reader_stream.bytes_fetched
        result.requests = reader_stream.requests
        reader_stream.close()

    result.topics_written = list(written_topics)
    logger.info(
        "partial mcap download: wrote %d messages, fetched %d of %d bytes in %d requests",
        result.messages_written,
        result.bytes_fetched,
        result.remote_size,
        result.requests,
    )
    return result
