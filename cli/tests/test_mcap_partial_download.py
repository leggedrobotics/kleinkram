from __future__ import annotations

import random
import re
import threading
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from pathlib import Path
from typing import Iterator
from typing import List
from typing import Tuple

import pytest

from kleinkram.api.mcap_filter import filter_mcap_from_url
from kleinkram.api.mcap_filter import is_mcap
from kleinkram.api.range_reader import HttpRangeReader
from kleinkram.api.range_reader import RangeRequestsUnsupported

mcap_writer = pytest.importorskip("mcap.writer")
mcap_reader = pytest.importorskip("mcap.reader")


TOPICS = ("/tf", "/odom", "/camera")
PAYLOAD_SIZES = {"/tf": 64, "/odom": 128, "/camera": 4096}
MESSAGES_PER_TOPIC = 400
INTERVAL_NS = 10_000_000  # 100 Hz


def _payload(topic: str, index: int) -> bytes:
    """Deterministic pseudo-random bytes, so two fixtures agree byte for byte."""
    rng = random.Random(f"{topic}:{index}")
    return bytes(rng.getrandbits(8) for _ in range(PAYLOAD_SIZES[topic]))


def _write_mcap(path: Path, *, compression=None) -> None:
    kwargs = {} if compression is None else {"compression": compression}
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
    """Serves one file, honouring Range like S3 does."""

    served_path: Path
    requests: List[Tuple[int, int]]
    honour_range = True

    def log_message(self, *args: object) -> None:
        pass

    def _body(self) -> bytes:
        return self.served_path.read_bytes()

    def do_HEAD(self) -> None:
        self.send_response(200)
        self.send_header("Content-Length", str(self.served_path.stat().st_size))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()

    def do_GET(self) -> None:
        data = self._body()
        header = self.headers.get("Range")

        if header is None or not self.honour_range:
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        match = re.match(r"bytes=(\d+)-(\d*)", header)
        assert match is not None
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else len(data) - 1
        end = min(end, len(data) - 1)
        self.requests.append((start, end))

        stop = end + 1
        chunk = data[start:stop]
        self.send_response(206)
        self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
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


def _serve(path: Path):
    """Start a range-capable server for one file; returns (url, requests, stop)."""
    requests: List[Tuple[int, int]] = []
    handler = type(
        "BoundHandler",
        (_RangeHandler,),
        {"served_path": path, "requests": requests, "honour_range": True},
    )
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def stop() -> None:
        server.shutdown()
        server.server_close()

    return f"http://127.0.0.1:{server.server_port}/recording.mcap", requests, stop


@pytest.fixture
def served(mcap_file: Path) -> Iterator[Tuple[str, List[Tuple[int, int]]]]:
    requests: List[Tuple[int, int]] = []

    handler = type(
        "BoundHandler",
        (_RangeHandler,),
        {"served_path": mcap_file, "requests": requests, "honour_range": True},
    )
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/recording.mcap", requests
    finally:
        server.shutdown()
        server.server_close()


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
    handler = type(
        "IgnoringHandler",
        (_RangeHandler,),
        {"served_path": mcap_file, "requests": [], "honour_range": False},
    )
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        url = f"http://127.0.0.1:{server.server_port}/recording.mcap"
        with pytest.raises(RangeRequestsUnsupported):
            reader = HttpRangeReader(url)
            reader.seek(0)
            reader.read(16)
    finally:
        server.shutdown()
        server.server_close()


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
    url, _requests, stop = _serve(compressed_mcap_file)
    try:
        result = filter_mcap_from_url(url, tmp_path / "out.mcap", topics=["/tf"])
    finally:
        stop()

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

    slow_url, _requests, stop = _serve(compressed_mcap_file)
    try:
        slow = tmp_path / "slow.mcap"
        filter_mcap_from_url(slow_url, slow, topics=["/odom"], start_time=50 * INTERVAL_NS, end_time=150 * INTERVAL_NS)
    finally:
        stop()

    def messages(path: Path):
        with path.open("rb") as handle:
            reader = mcap_reader.make_reader(handle)
            return [(c.topic, m.log_time, m.data) for _s, c, m in reader.iter_messages()]

    assert messages(fast) == messages(slow)
