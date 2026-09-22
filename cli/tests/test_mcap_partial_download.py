from __future__ import annotations

import random
import re
import threading
from contextlib import contextmanager
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import Iterator
from typing import List
from typing import Optional
from typing import Tuple
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
import typer
from typer.testing import CliRunner

import kleinkram
import kleinkram.api.routes
import kleinkram.core
from kleinkram.api import file_transfer
from kleinkram.api import mcap_filter
from kleinkram.api.file_transfer import DownloadState
from kleinkram.api.file_transfer import McapSlice
from kleinkram.api.file_transfer import download_file
from kleinkram.api.mcap_filter import filter_mcap_from_url
from kleinkram.api.mcap_filter import is_mcap
from kleinkram.api.mcap_index import ChunkLayout
from kleinkram.api.mcap_index import MessageExtent
from kleinkram.api.mcap_index import UnsupportedChunkEncoding
from kleinkram.api.mcap_index import chunk_data_start
from kleinkram.api.mcap_index import coalesce
from kleinkram.api.mcap_index import plan_chunk
from kleinkram.api.mcap_index import read_chunk_layout
from kleinkram.api.range_reader import HttpRangeReader
from kleinkram.api.range_reader import RangeRequestsUnsupported
from kleinkram.cli._download import _parse_log_time
from kleinkram.models import File
from kleinkram.models import FileState

mcap_writer = pytest.importorskip("mcap.writer")
mcap_reader = pytest.importorskip("mcap.reader")


TOPICS = ("/tf", "/odom", "/camera")
PAYLOAD_SIZES = {"/tf": 64, "/odom": 128, "/camera": 4096}
MESSAGES_PER_TOPIC = 400
INTERVAL_NS = 10_000_000  # 100 Hz


def _payload(topic: str, index: int) -> bytes:
    """Deterministic pseudo-random bytes, so two fixtures agree byte for byte."""
    return random.Random(f"{topic}:{index}").randbytes(PAYLOAD_SIZES[topic])


def _write_mcap(path: Path, *, compression=None, **writer_kwargs) -> None:
    kwargs = dict(writer_kwargs)
    if compression is not None:
        kwargs["compression"] = compression
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, chunk_size=64 * 1024, **kwargs)
        writer.start(profile="ros2", library="test")
        schema_id = writer.register_schema(name="test/Dummy", encoding="jsonschema", data=b"{}")
        channels = {
            topic: writer.register_channel(topic=topic, message_encoding="cdr", schema_id=schema_id) for topic in TOPICS
        }
        for index in range(MESSAGES_PER_TOPIC):
            log_time = index * INTERVAL_NS
            for topic, channel_id in channels.items():
                writer.add_message(
                    channel_id=channel_id,
                    log_time=log_time,
                    data=_payload(topic, index),
                    publish_time=log_time,
                )
        writer.finish()


class _RangeHandler(BaseHTTPRequestHandler):
    """Serves one file, honouring Range like S3 does.

    `fail_after` makes every range request after that many answer 500, to
    simulate storage failing half way through a download.
    """

    served_path: Path
    requests: List[Tuple[int, int]]
    honour_range = True
    fail_after: Optional[int] = None
    # Headers and body go out as separate writes; with Nagle on, each small
    # response then waits for a delayed ACK and the tests crawl.
    disable_nagle_algorithm = True
    # Keep-alive, as S3 does; a fresh connection per range dominates otherwise.
    protocol_version = "HTTP/1.1"

    def log_message(self, *args: object) -> None:
        pass

    def do_GET(self) -> None:
        size = self.served_path.stat().st_size
        header = self.headers.get("Range")

        if header is None or not self.honour_range:
            data = self.served_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if self.fail_after is not None and len(self.requests) >= self.fail_after:
            self.send_response(500)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        match = re.match(r"bytes=(\d+)-(\d*)", header)
        assert match is not None
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else size - 1
        end = min(end, size - 1)
        self.requests.append((start, end))

        with self.served_path.open("rb") as handle:
            handle.seek(start)
            chunk = handle.read(end - start + 1)
        self.send_response(206)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(len(chunk)))
        self.end_headers()
        self.wfile.write(chunk)


@pytest.fixture
def mcap_file(tmp_path: Path) -> Path:
    """An uncompressed recording, as produced by our own recorders.

    Uncompressed chunks are what make individual messages addressable, which is
    the case worth testing hardest.
    """
    path = tmp_path / "recording.mcap"
    _write_mcap(path, compression=mcap_writer.CompressionType.NONE)
    return path


@pytest.fixture
def compressed_mcap_file(tmp_path: Path) -> Path:
    path = tmp_path / "compressed.mcap"
    _write_mcap(path, compression=mcap_writer.CompressionType.ZSTD)
    return path


@contextmanager
def _serve(path: Path, *, honour_range: bool = True, fail_after: Optional[int] = None):
    """Serve one file over HTTP; yields (url, requests) where requests logs each range."""
    requests: List[Tuple[int, int]] = []
    handler = type(
        "BoundHandler",
        (_RangeHandler,),
        {"served_path": path, "requests": requests, "honour_range": honour_range, "fail_after": fail_after},
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/{path.name}", requests
    finally:
        server.shutdown()
        server.server_close()


@pytest.fixture
def served(mcap_file: Path) -> Iterator[Tuple[str, List[Tuple[int, int]]]]:
    with _serve(mcap_file) as served:
        yield served


def _messages(path: Path) -> List[Tuple[str, int, int, int, bytes]]:
    with path.open("rb") as handle:
        reader = mcap_reader.make_reader(handle)
        return [(c.topic, m.log_time, m.publish_time, m.sequence, m.data) for _s, c, m in reader.iter_messages()]


def _library_filter(path: Path, **kwargs) -> List[Tuple[str, int, int, int, bytes]]:
    """What `mcap` itself returns for the same selection on the local file."""
    with path.open("rb") as handle:
        reader = mcap_reader.make_reader(handle)
        return [(c.topic, m.log_time, m.publish_time, m.sequence, m.data) for _s, c, m in reader.iter_messages(**kwargs)]


def test_is_mcap() -> None:
    assert is_mcap(Path("a.mcap"))
    assert is_mcap(Path("a.MCAP"))
    assert not is_mcap(Path("a.bag"))
    assert not is_mcap(Path("a.db3"))


def test_range_reader_reports_size_and_reads(served: Tuple[str, List[Tuple[int, int]]], mcap_file: Path) -> None:
    url, _ = served
    reader = HttpRangeReader(url, block_size=8192)
    try:
        assert reader.size == mcap_file.stat().st_size

        expected = mcap_file.read_bytes()
        reader.seek(0)
        assert reader.read(16) == expected[:16]

        reader.seek(1000)
        assert reader.read(32) == expected[1000:1032]

        reader.seek(-8, 2)
        assert reader.read(8) == expected[-8:]
    finally:
        reader.close()


def test_range_reader_caches_blocks(served: Tuple[str, List[Tuple[int, int]]]) -> None:
    url, requests = served
    reader = HttpRangeReader(url, block_size=65536)
    try:
        reader.seek(0)
        reader.read(16)
        after_first = len(requests)

        # Everything here lands inside the block already fetched.
        for offset in range(0, 4096, 64):
            reader.seek(offset)
            reader.read(8)

        assert len(requests) == after_first
    finally:
        reader.close()


def test_range_reader_rejects_server_ignoring_range(mcap_file: Path) -> None:
    with _serve(mcap_file, honour_range=False) as (url, _requests):
        with pytest.raises(RangeRequestsUnsupported):
            HttpRangeReader(url)


@pytest.mark.parametrize("fault", ["shifted", "short"])
def test_range_reader_rejects_a_wrong_partial_response(fault: str) -> None:
    """A 206 for a different interval, or with bytes missing, must not be used."""
    body = bytes(range(256)) * 16

    def handler(request: httpx.Request) -> httpx.Response:
        start, end = (int(x) for x in request.headers["range"].removeprefix("bytes=").split("-"))
        stop = end + 1
        if (start, end) != (0, 0):
            if fault == "shifted":
                start, end, stop = start + 1, end + 1, stop + 1
            else:
                stop -= 1  # the header claims the full range, the body is a byte short
        headers = {"Content-Range": f"bytes {start}-{end}/{len(body)}"}
        return httpx.Response(206, headers=headers, content=body[start:stop])

    reader = HttpRangeReader("http://storage/file.mcap", client=httpx.Client(transport=httpx.MockTransport(handler)))
    with pytest.raises(IOError):
        reader.read_exact(100, 50)


def test_filter_by_topic_keeps_only_that_topic(served: Tuple[str, List[Tuple[int, int]]], tmp_path: Path) -> None:
    url, _ = served
    dest = tmp_path / "out.mcap"

    result = filter_mcap_from_url(url, dest, topics=["/tf"])

    assert result.messages_written == MESSAGES_PER_TOPIC
    assert result.topics_written == ["/tf"]

    with dest.open("rb") as handle:
        reader = mcap_reader.make_reader(handle)
        summary = reader.get_summary()
        assert [channel.topic for channel in summary.channels.values()] == ["/tf"]
        assert reader.get_header().profile == "ros2"


def test_filter_by_time_restricts_the_window(served: Tuple[str, List[Tuple[int, int]]], tmp_path: Path) -> None:
    url, _ = served
    dest = tmp_path / "out.mcap"
    start = 100 * INTERVAL_NS
    end = 150 * INTERVAL_NS

    result = filter_mcap_from_url(url, dest, start_time=start, end_time=end)

    # end_time is exclusive, and every topic ticks at the same rate.
    assert result.messages_written == 50 * len(TOPICS)

    with dest.open("rb") as handle:
        reader = mcap_reader.make_reader(handle)
        for _schema, _channel, message in reader.iter_messages():
            assert start <= message.log_time < end


def test_filter_by_time_transfers_less_than_the_whole_file(
    served: Tuple[str, List[Tuple[int, int]]], tmp_path: Path, mcap_file: Path
) -> None:
    url, _ = served
    total = mcap_file.stat().st_size

    # A small block size keeps the fixture file small while still exercising
    # the case that matters: fetching a fraction of the chunks.
    result = filter_mcap_from_url(
        url,
        tmp_path / "slice.mcap",
        start_time=0,
        end_time=20 * INTERVAL_NS,
        block_size=16 * 1024,
    )

    assert result.remote_size == total
    assert result.bytes_fetched < total
    assert result.messages_written == 20 * len(TOPICS)


def test_filter_writes_a_readable_file_with_no_matches(served: Tuple[str, List[Tuple[int, int]]], tmp_path: Path) -> None:
    url, _ = served
    dest = tmp_path / "empty.mcap"

    result = filter_mcap_from_url(url, dest, topics=["/does-not-exist"])

    assert result.messages_written == 0
    assert dest.exists()
    with dest.open("rb") as handle:
        assert mcap_reader.make_reader(handle).get_summary() is not None


def test_single_topic_costs_a_fraction_of_the_file(
    served: Tuple[str, List[Tuple[int, int]]], tmp_path: Path, mcap_file: Path
) -> None:
    """The point of the whole feature: one low-rate topic must not cost the file.

    `/tf` is 64 byte payloads and `/camera` is 4096, so `/tf` is a few percent of
    the bytes. Fetching whole chunks would transfer essentially all of it.
    """
    url, _ = served
    total = mcap_file.stat().st_size

    # The gap must be smaller than the spacing between consecutive /tf records,
    # or every range merges and the whole file comes down. Messages here sit
    # roughly 4 KB apart.
    # Both knobs have to suit the file. The gap must be under the spacing
    # between consecutive /tf records (~4 KB here) or every range merges; the
    # block size governs the one-off summary read, which on a fixture this small
    # would otherwise pull the whole file by itself.
    result = filter_mcap_from_url(
        url,
        tmp_path / "tf.mcap",
        topics=["/tf"],
        coalesce_gap=512,
        block_size=32 * 1024,
    )

    assert result.indexed is True
    assert result.messages_written == MESSAGES_PER_TOPIC
    assert result.topics_written == ["/tf"]
    # Generous bound: the measured share is far below this, but the exact figure
    # depends on record framing and index size.
    assert result.bytes_fetched < total * 0.35, (
        f"fetched {result.bytes_fetched} of {total} bytes for a topic that is a " "few percent of the payload"
    )


def test_compressed_chunks_fall_back_but_stay_correct(compressed_mcap_file: Path, tmp_path: Path) -> None:
    """Compressed chunks cannot be addressed per message; the result must still be right."""
    with _serve(compressed_mcap_file) as (url, _requests):
        result = filter_mcap_from_url(url, tmp_path / "out.mcap", topics=["/tf"])

    assert result.indexed is False
    assert result.messages_written == MESSAGES_PER_TOPIC
    assert result.topics_written == ["/tf"]


def test_indexed_and_fallback_agree(
    served: Tuple[str, List[Tuple[int, int]]],
    compressed_mcap_file: Path,
    tmp_path: Path,
) -> None:
    """The fast path must produce the same messages as the library reader."""
    url, _ = served
    fast = tmp_path / "fast.mcap"
    filter_mcap_from_url(url, fast, topics=["/odom"], start_time=50 * INTERVAL_NS, end_time=150 * INTERVAL_NS)

    with _serve(compressed_mcap_file) as (slow_url, _requests):
        slow = tmp_path / "slow.mcap"
        filter_mcap_from_url(slow_url, slow, topics=["/odom"], start_time=50 * INTERVAL_NS, end_time=150 * INTERVAL_NS)

    assert _messages(fast) == _messages(slow)


# --- selection semantics -----------------------------------------------------


@pytest.mark.parametrize(
    "selection",
    [
        {"topics": ["/tf"]},
        {"topics": ["/tf", "/camera"]},
        {"start_time": 37 * INTERVAL_NS, "end_time": 211 * INTERVAL_NS},
        {"topics": ["/odom"], "start_time": 5 * INTERVAL_NS + 1, "end_time": 90 * INTERVAL_NS - 1},
        {"start_time": 390 * INTERVAL_NS},
        {"end_time": 3 * INTERVAL_NS},
    ],
    ids=["one-topic", "two-topics", "window", "topic-and-odd-window", "open-end", "open-start"],
)
@pytest.mark.parametrize("compressed", [False, True], ids=["uncompressed", "zstd"])
def test_output_matches_the_mcap_library(
    selection, compressed: bool, mcap_file: Path, compressed_mcap_file: Path, tmp_path: Path
) -> None:
    """Whatever path is taken, the slice holds exactly what `mcap` itself would select."""
    source = compressed_mcap_file if compressed else mcap_file
    dest = tmp_path / "slice.mcap"

    with _serve(source) as (url, _requests):
        result = filter_mcap_from_url(url, dest, coalesce_gap=512, **selection)

    expected = _library_filter(source, **selection)
    assert expected, "selection should not be empty"
    assert _messages(dest) == expected
    assert result.messages_written == len(expected)
    assert result.indexed is not compressed


def test_time_window_is_start_inclusive_end_exclusive(served, tmp_path: Path) -> None:
    """Bounds that land exactly on a message: the start one is kept, the end one dropped."""
    url, _ = served
    dest = tmp_path / "out.mcap"

    filter_mcap_from_url(url, dest, topics=["/tf"], start_time=10 * INTERVAL_NS, end_time=12 * INTERVAL_NS)

    assert [log_time for _topic, log_time, *_rest in _messages(dest)] == [10 * INTERVAL_NS, 11 * INTERVAL_NS]


def test_output_keeps_schema_channel_and_profile(served, tmp_path: Path) -> None:
    url, _ = served
    dest = tmp_path / "out.mcap"

    filter_mcap_from_url(url, dest, topics=["/odom"], end_time=5 * INTERVAL_NS)

    with dest.open("rb") as handle:
        reader = mcap_reader.make_reader(handle)
        summary = reader.get_summary()
        assert reader.get_header().profile == "ros2"
        (channel,) = summary.channels.values()
        assert channel.topic == "/odom"
        assert channel.message_encoding == "cdr"
        schema = summary.schemas[channel.schema_id]
        assert (schema.name, schema.encoding, schema.data) == ("test/Dummy", "jsonschema", b"{}")
        assert summary.statistics.message_count == 5


def test_chunks_without_message_indexes_are_not_skipped(tmp_path: Path) -> None:
    """A chunk with no message index may still hold the topic; it must be read, not dropped."""
    source = tmp_path / "no-message-index.mcap"
    _write_mcap(
        source,
        compression=mcap_writer.CompressionType.NONE,
        index_types=mcap_writer.IndexType.CHUNK,
    )
    dest = tmp_path / "out.mcap"

    with _serve(source) as (url, _requests):
        result = filter_mcap_from_url(url, dest, topics=["/tf"])

    assert result.indexed is False
    assert result.messages_written == MESSAGES_PER_TOPIC
    assert _messages(dest) == _library_filter(source, topics=["/tf"])


# --- transfer size -----------------------------------------------------------


@pytest.fixture
def sparse_topic_mcap(tmp_path: Path) -> Path:
    """A 10 Hz topic buried in a 100 Hz, 8 KB/message stream: ~80 KB between hits.

    That spacing is above the default coalesce gap, so with default settings
    the sparse topic must come down as small separate ranges.
    """
    path = tmp_path / "sparse.mcap"
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, compression=mcap_writer.CompressionType.NONE)
        writer.start(profile="ros2", library="test")
        schema_id = writer.register_schema(name="test/Dummy", encoding="jsonschema", data=b"{}")
        camera = writer.register_channel(topic="/camera", message_encoding="cdr", schema_id=schema_id)
        sparse = writer.register_channel(topic="/sparse", message_encoding="cdr", schema_id=schema_id)
        for index in range(2000):
            log_time = index * INTERVAL_NS
            payload = random.Random(index).randbytes(8192)
            writer.add_message(camera, log_time=log_time, data=payload, publish_time=log_time)
            if index % 10 == 0:
                writer.add_message(sparse, log_time=log_time, data=b"x" * 64, publish_time=log_time)
        writer.finish()
    return path


def test_sparse_topic_with_defaults_fetches_a_small_fraction(sparse_topic_mcap: Path, tmp_path: Path) -> None:
    """Regression guard: planning mistakes (a coalesce gap that merges every
    range, or reads going through the block cache) silently turn a partial
    download into a whole-file one while still producing the right output.
    """
    total = sparse_topic_mcap.stat().st_size
    dest = tmp_path / "sparse-only.mcap"

    with _serve(sparse_topic_mcap) as (url, requests):
        result = filter_mcap_from_url(url, dest, topics=["/sparse"])

    assert result.indexed is True
    assert result.messages_written == 200
    assert _messages(dest) == _library_filter(sparse_topic_mcap, topics=["/sparse"])
    # The header and summary each cost one 1 MB block, everything else is
    # indexes and the 200 small records. Whole-file behaviour would be ~16 MB.
    assert result.bytes_fetched < total * 0.2, f"fetched {result.bytes_fetched} of {total} bytes"
    # The probe's single byte is not counted as payload.
    assert sum(end - start + 1 for start, end in requests) == result.bytes_fetched + 1
    assert max(end - start + 1 for start, end in requests) <= 1024 * 1024


def test_progress_callbacks_cover_the_planned_transfer(served, tmp_path: Path) -> None:
    url, _ = served
    totals: List[int] = []
    increments: List[int] = []

    filter_mcap_from_url(
        url,
        tmp_path / "out.mcap",
        topics=["/tf"],
        coalesce_gap=512,
        on_start=totals.append,
        on_progress=increments.append,
    )

    assert len(totals) == 1
    assert totals[0] > 0
    assert sum(increments) == totals[0]


# --- failure handling --------------------------------------------------------


def test_failure_mid_download_leaves_existing_file_untouched(mcap_file: Path, tmp_path: Path) -> None:
    dest = tmp_path / "out.mcap"
    dest.write_bytes(b"the full recording the user already had")

    # Enough requests to read the summary and indexes, then storage fails.
    with _serve(mcap_file, fail_after=6) as (url, _requests):
        with pytest.raises(Exception):
            filter_mcap_from_url(url, dest, topics=["/tf"], coalesce_gap=512, concurrency=1, block_size=8192)

    assert dest.read_bytes() == b"the full recording the user already had"
    assert list(tmp_path.glob("*.part")) == []


def test_failure_mid_download_leaves_no_file(mcap_file: Path, tmp_path: Path) -> None:
    out_dir = tmp_path / "out"
    dest = out_dir / "out.mcap"

    with _serve(mcap_file, fail_after=6) as (url, _requests):
        with pytest.raises(Exception):
            filter_mcap_from_url(url, dest, topics=["/tf"], coalesce_gap=512, concurrency=4, block_size=8192)

    assert list(out_dir.iterdir()) == []


def test_concurrent_downloads_to_one_destination_do_not_collide(served, mcap_file: Path, tmp_path: Path) -> None:
    url, _ = served
    dest = tmp_path / "out" / "slice.mcap"
    errors: List[BaseException] = []

    def run() -> None:
        try:
            filter_mcap_from_url(url, dest, topics=["/tf"], coalesce_gap=512, block_size=8192)
        except BaseException as e:  # reported through the assertion below
            errors.append(e)

    threads = [threading.Thread(target=run) for _ in range(4)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert _messages(dest) == _library_filter(mcap_file, topics=["/tf"])
    assert list(dest.parent.iterdir()) == [dest]


def test_server_without_range_support_is_rejected_before_writing(mcap_file: Path, tmp_path: Path) -> None:
    dest = tmp_path / "out.mcap"

    with _serve(mcap_file, honour_range=False) as (url, _requests):
        with pytest.raises(RangeRequestsUnsupported):
            filter_mcap_from_url(url, dest, topics=["/tf"])

    assert not dest.exists()


def test_index_pointing_at_the_wrong_bytes_fails_loudly(served, tmp_path: Path, monkeypatch) -> None:
    """If message offsets are miscomputed, the download must fail, not drop messages."""
    real = mcap_filter.chunk_data_start
    monkeypatch.setattr(mcap_filter, "chunk_data_start", lambda offset, compression: real(offset, compression) + 1)
    url, _ = served

    with pytest.raises(mcap_filter.McapIndexMismatch):
        filter_mcap_from_url(url, tmp_path / "out.mcap", topics=["/tf"])
    assert not (tmp_path / "out.mcap").exists()


# --- index helpers -----------------------------------------------------------


def test_plan_chunk_ends_each_record_at_the_next_boundary_of_any_channel() -> None:
    layout = ChunkLayout(data_start=1000, uncompressed_size=300, compression="")
    indexes = {1: [(10, 0), (30, 200)], 2: [(20, 120)]}

    extents = plan_chunk(layout, indexes, wanted_channels={1}, start_time=None, end_time=None)

    # The last record runs to the end of the chunk data.
    assert [(e.start, e.end) for e in extents] == [(1000, 1120), (1200, 1300)]


def test_plan_chunk_time_bounds() -> None:
    layout = ChunkLayout(data_start=0, uncompressed_size=300, compression="")
    indexes = {1: [(10, 0), (20, 100), (30, 200)]}

    extents = plan_chunk(layout, indexes, wanted_channels=None, start_time=20, end_time=30)

    assert [e.log_time for e in extents] == [20]


def test_plan_chunk_rejects_compressed_chunks() -> None:
    layout = ChunkLayout(data_start=0, uncompressed_size=300, compression="zstd")
    with pytest.raises(UnsupportedChunkEncoding):
        plan_chunk(layout, {1: [(10, 0)]}, wanted_channels=None, start_time=None, end_time=None)


def test_coalesce_merges_only_within_the_gap() -> None:
    extents = [MessageExtent(start, start + 10, 1, 0) for start in (0, 15, 100, 200)]
    ranges = coalesce(extents, gap=10)
    assert [(r.start, r.end) for r in ranges] == [(0, 25), (100, 110), (200, 210)]


@pytest.mark.parametrize("compressed", [False, True], ids=["uncompressed", "zstd"])
def test_chunk_data_start_matches_the_real_header(compressed: bool, mcap_file: Path, compressed_mcap_file: Path) -> None:
    """The derived offset must agree with parsing the header, for every chunk."""
    source = compressed_mcap_file if compressed else mcap_file
    with source.open("rb") as handle:
        summary = mcap_reader.make_reader(handle).get_summary()
        for chunk_index in summary.chunk_indexes:
            layout = read_chunk_layout(handle, chunk_index.chunk_start_offset)
            assert chunk_data_start(chunk_index.chunk_start_offset, chunk_index.compression) == layout.data_start


# --- download_file / SDK / CLI integration -----------------------------------


def _remote_file(name: str, *, state: FileState = FileState.OK, size: int = 0) -> File:
    now = datetime.now(timezone.utc)
    return File(
        id=uuid4(),
        name=name,
        hash="not-a-real-hash",
        size=size,
        type_="MCAP",
        date=now,
        created_at=now,
        updated_at=now,
        mission_id=uuid4(),
        mission_name="mission",
        project_id=uuid4(),
        project_name="project",
        state=state,
    )


@pytest.fixture
def remote_mcap(served, mcap_file: Path, monkeypatch) -> File:
    """A remote file whose presigned URL points at the local range server."""
    url, _ = served
    monkeypatch.setattr(file_transfer, "_get_file_download", lambda client, file_id: url)
    return _remote_file("recording.mcap", size=mcap_file.stat().st_size)


def test_download_file_slices_mcap(remote_mcap: File, mcap_file: Path, tmp_path: Path) -> None:
    path = tmp_path / "out" / "recording.mcap"
    started: List[int] = []
    progressed: List[int] = []
    window = {"start_time": 0, "end_time": 100 * INTERVAL_NS}

    state, transferred = download_file(
        MagicMock(),
        file=remote_mcap,
        path=path,
        create_parents=True,
        mcap_slice=McapSlice(topics=("/tf",), **window),
        on_file_start_cb=lambda p, total: started.append(total),
        on_file_progress_cb=lambda p, n: progressed.append(n),
    )

    assert state == DownloadState.DOWNLOADED_PARTIAL
    # (The transfer bound is tested on a file big enough for it to be meaningful.)
    assert transferred > 0
    assert _messages(path) == _library_filter(mcap_file, topics=["/tf"], **window)
    assert started and sum(progressed) == started[-1]


def test_download_file_skips_non_mcap_without_fetching(tmp_path: Path, monkeypatch) -> None:
    fetch = MagicMock(side_effect=AssertionError("must not request a download URL"))
    monkeypatch.setattr(file_transfer, "_get_file_download", fetch)

    for name in ("recording.bag", "recording.db3"):
        state, transferred = download_file(
            MagicMock(), file=_remote_file(name), path=tmp_path / name, mcap_slice=McapSlice(topics=("/tf",))
        )
        assert (state, transferred) == (DownloadState.SKIPPED_NOT_SLICEABLE, 0)
        assert not (tmp_path / name).exists()


@pytest.mark.parametrize(
    "state, expected",
    [
        (FileState.UPLOADING, DownloadState.SKIPPED_INVALID_REMOTE_STATE),
        (FileState.ERROR, DownloadState.SKIPPED_INVALID_REMOTE_STATE),
        (FileState.CORRUPTED, DownloadState.SKIPPED_CORRUPTED),
    ],
)
def test_download_file_slice_respects_remote_state(state, expected, tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(file_transfer, "_get_file_download", MagicMock(side_effect=AssertionError("must not fetch")))
    result = download_file(
        MagicMock(),
        file=_remote_file("recording.mcap", state=state),
        path=tmp_path / "recording.mcap",
        mcap_slice=McapSlice(topics=("/tf",)),
    )
    assert result == (expected, 0)


def test_download_file_slice_does_not_replace_existing_file_unless_asked(remote_mcap: File, tmp_path: Path) -> None:
    # (tmp_path/recording.mcap is the file being served.)
    path = tmp_path / "local" / "recording.mcap"
    path.parent.mkdir()
    path.write_bytes(b"the full recording")
    mcap_slice = McapSlice(topics=("/tf",))

    state, _ = download_file(MagicMock(), file=remote_mcap, path=path, mcap_slice=mcap_slice)
    assert state == DownloadState.SKIPPED_SLICE_EXISTS
    assert path.read_bytes() == b"the full recording"

    state, _ = download_file(MagicMock(), file=remote_mcap, path=path, mcap_slice=mcap_slice, overwrite=True)
    assert state == DownloadState.DOWNLOADED_PARTIAL
    assert {topic for topic, *_rest in _messages(path)} == {"/tf"}


def test_download_file_without_range_support_fails_cleanly(mcap_file: Path, tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "local" / "recording.mcap"
    path.parent.mkdir()
    with _serve(mcap_file, honour_range=False) as (url, _requests):
        monkeypatch.setattr(file_transfer, "_get_file_download", lambda client, file_id: url)
        with pytest.raises(RangeRequestsUnsupported):
            download_file(MagicMock(), file=_remote_file("recording.mcap"), path=path, mcap_slice=McapSlice(topics=("/tf",)))
    assert list(path.parent.iterdir()) == []


def test_mcap_slice_is_falsy_when_empty_and_validates_the_window() -> None:
    assert not McapSlice()
    assert McapSlice(topics=("/tf",))
    assert McapSlice(start_time=0)
    assert McapSlice(end_time=0)
    with pytest.raises(ValueError):
        McapSlice(start_time=10, end_time=10)


def test_sdk_download_slices(remote_mcap: File, mcap_file: Path, tmp_path: Path, monkeypatch) -> None:
    """`kleinkram.download(topics=..., start_time=..., end_time=...)` end to end, API mocked."""
    monkeypatch.setattr(kleinkram.api.routes, "get_files", lambda client, file_query: [remote_mcap])
    dest = tmp_path / "dest"
    dest.mkdir()
    window = {"start_time": 100 * INTERVAL_NS, "end_time": 200 * INTERVAL_NS}

    result = kleinkram.download(
        file_ids=[remote_mcap.id],
        dest=dest,
        topics="/tf",  # a bare string must mean one topic
        client=MagicMock(),
        **window,
    )

    assert result.failed == 0
    assert result.state_counts == {DownloadState.DOWNLOADED_PARTIAL: 1}
    assert result.total_bytes > 0
    assert _messages(dest / "recording.mcap") == _library_filter(mcap_file, topics=["/tf"], **window)


def test_sdk_download_without_filters_is_a_normal_download(tmp_path: Path, monkeypatch) -> None:
    captured = {}

    def fake_core_download(**kwargs):
        captured.update(kwargs)
        return file_transfer.DownloadResult()

    monkeypatch.setattr(kleinkram.core, "download", fake_core_download)
    kleinkram.download(file_ids=[uuid4()], dest=tmp_path, client=MagicMock())
    assert captured["mcap_slice"] is None


def _plain(output: str) -> str:
    """CLI output without colour codes or the error panel's frame and wrapping.

    Rich colours its output on CI (and not locally), and wraps error panels.
    """
    output = re.sub(r"\x1b\[[0-9;]*m", "", output)
    output = re.sub(r"[│╭╮╰╯─]", " ", output)
    return " ".join(output.split())


@pytest.fixture
def cli_app(remote_mcap: File, monkeypatch):
    """The real `klein` app, with the API and config layers stubbed out."""
    import kleinkram.cli._download as cli_download
    import kleinkram.cli.app as app_module

    monkeypatch.setattr(app_module, "check_config_compatibility", lambda *args, **kwargs: True)
    monkeypatch.setattr(app_module, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(cli_download, "AuthenticatedClient", MagicMock)
    monkeypatch.setattr(kleinkram.api.routes, "get_files", lambda client, file_query: [remote_mcap])
    return app_module.app


@pytest.mark.parametrize("verbose", [True, False], ids=["verbose", "quiet"])
def test_cli_download_slices(cli_app, remote_mcap: File, mcap_file: Path, tmp_path: Path, verbose: bool) -> None:
    dest = tmp_path / "dest"
    start = datetime(1970, 1, 1, tzinfo=timezone.utc) + timedelta(microseconds=100 * INTERVAL_NS // 1000)
    args = [] if verbose else ["--no-verbose"]
    # `download` is a command group, so options must come before the files.
    args += [
        "download",
        "--dest",
        str(dest),
        "--create-dirs",
        "--topics",
        "/tf",
        "--topics",
        "/odom",
        "--start-time",
        start.isoformat(),
        "--end-time",
        str(150 * INTERVAL_NS),
        str(remote_mcap.id),
    ]

    outcome = CliRunner().invoke(cli_app, args)

    assert outcome.exit_code == 0, outcome.output
    assert _messages(dest / "recording.mcap") == _library_filter(
        mcap_file, topics=["/tf", "/odom"], start_time=100 * INTERVAL_NS, end_time=150 * INTERVAL_NS
    )
    if verbose:
        assert "1 downloaded partially" in _plain(outcome.output)


def test_cli_download_rejects_an_inverted_window(cli_app, remote_mcap: File, tmp_path: Path) -> None:
    dest = tmp_path / "dest"
    outcome = CliRunner().invoke(
        cli_app,
        ["download", "--dest", str(dest), "--start-time", "200", "--end-time", "100", str(remote_mcap.id)],
    )
    assert outcome.exit_code != 0
    assert "--end-time must be after --start-time" in _plain(outcome.output)
    assert not dest.exists()


def test_cli_download_rejects_an_unparseable_time(cli_app, remote_mcap: File, tmp_path: Path) -> None:
    outcome = CliRunner().invoke(cli_app, ["download", "--dest", str(tmp_path), "--start-time", "soon", str(remote_mcap.id)])
    assert outcome.exit_code != 0
    assert "--start-time must be an ISO 8601 timestamp" in _plain(outcome.output)


@pytest.mark.parametrize(
    "value, expected",
    [
        (None, None),
        ("0", 0),
        ("1789718908373212789", 1789718908373212789),
        ("1970-01-01T00:00:01Z", 1_000_000_000),
        ("1970-01-01T00:00:01", 1_000_000_000),  # no zone reads as UTC
        ("1970-01-01T01:00:01+01:00", 1_000_000_000),
        # Exact to the microsecond; float arithmetic is off by up to ~256 ns here.
        ("2026-09-18T08:08:28.123457Z", 1789718908123457000),
    ],
)
def test_parse_log_time_accepts(value, expected) -> None:
    assert _parse_log_time(value, "--start-time") == expected


@pytest.mark.parametrize("value", ["", "soon", "-5", "2026-13-01T00:00:00Z", "1.5e9"])
def test_parse_log_time_rejects(value) -> None:
    with pytest.raises(typer.BadParameter):
        _parse_log_time(value, "--start-time")
