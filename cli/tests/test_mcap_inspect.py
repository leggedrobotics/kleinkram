from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator
from typing import List
from typing import Optional
from typing import Tuple
from unittest.mock import MagicMock

import pytest
from rich.console import Console
from typer.testing import CliRunner

import kleinkram
import kleinkram.api.routes
from kleinkram.api import file_transfer
from kleinkram.api.mcap_summary import McapInfo
from kleinkram.api.mcap_summary import read_mcap_info_from_url
from kleinkram.errors import FileTypeNotSupported
from kleinkram.errors import McapSummaryUnavailable
from kleinkram.models import File
from kleinkram.printing import _mcap_chunks_text
from kleinkram.printing import coverage_strip
from kleinkram.printing import format_log_time
from kleinkram.printing import mcap_metadata_table
from kleinkram.printing import mcap_topics_table
from tests.mcap_helpers import INTERVAL_NS
from tests.mcap_helpers import MESSAGES_PER_TOPIC
from tests.mcap_helpers import TOPICS
from tests.mcap_helpers import plain
from tests.mcap_helpers import remote_file
from tests.mcap_helpers import serve
from tests.mcap_helpers import write_mcap

mcap_writer = pytest.importorskip("mcap.writer")

START_NS = 1_789_718_908_000_000_000  # 2026-09-18T08:08:28Z
IMU_DEFINITION = "std_msgs/Header header\nfloat64[3] angular_velocity\n"
CALIBRATION = b"camera_matrix: [1.0, 0.0, 0.0]\n" * 64


def _write_annotated_mcap(path: Path, *, compression) -> None:
    """A recording that uses everything the summary section can index."""
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, chunk_size=16 * 1024, compression=compression)
        writer.start(profile="ros2", library="test-recorder 1.0")

        imu_schema = writer.register_schema(name="sensor_msgs/msg/Imu", encoding="ros2msg", data=IMU_DEFINITION.encode())
        binary_schema = writer.register_schema(name="pkg.Blob", encoding="protobuf", data=b"\xff\xfe\x00\x01")
        imu = writer.register_channel(topic="/imu", message_encoding="cdr", schema_id=imu_schema)
        # A second publisher on the same topic gets a channel of its own.
        imu_again = writer.register_channel(topic="/imu", message_encoding="cdr", schema_id=imu_schema)
        blob = writer.register_channel(topic="/blob", message_encoding="protobuf", schema_id=binary_schema)

        for index in range(200):
            log_time = START_NS + index * INTERVAL_NS
            writer.add_message(channel_id=imu, log_time=log_time, data=b"i" * 256, publish_time=log_time)
            if index % 2 == 0:
                writer.add_message(channel_id=imu_again, log_time=log_time, data=b"j" * 256, publish_time=log_time)
            if index % 10 == 0:
                writer.add_message(channel_id=blob, log_time=log_time, data=b"b" * 2048, publish_time=log_time)

        writer.add_attachment(
            create_time=START_NS, log_time=START_NS, name="calibration.yaml", media_type="application/yaml", data=CALIBRATION
        )
        writer.add_metadata(name="robot", data={"name": "anymal-d", "firmware": "24.04"})
        writer.add_metadata(name="operator", data={"name": "test"})
        writer.finish()


@pytest.fixture
def annotated(tmp_path: Path) -> Iterator[Tuple[str, List[Tuple[int, int]], Path]]:
    path = tmp_path / "annotated.mcap"
    _write_annotated_mcap(path, compression=mcap_writer.CompressionType.NONE)
    with serve(path) as (url, requests):
        yield url, requests, path


def test_reads_what_the_file_says_about_itself(annotated) -> None:
    url, _, _ = annotated

    info = read_mcap_info_from_url(url)

    assert (info.profile, info.library) == ("ros2", "test-recorder 1.0")
    assert info.message_count == 320
    assert info.start_time == START_NS
    assert info.end_time == START_NS + 199 * INTERVAL_NS
    assert info.duration == pytest.approx(1.99)

    topics = {topic.name: topic for topic in info.topics}
    assert list(topics) == ["/blob", "/imu"]
    # Both publishers of /imu are counted under the one topic.
    assert topics["/imu"].message_count == 300
    assert topics["/imu"].message_type == "sensor_msgs/msg/Imu"
    assert topics["/imu"].message_encoding == "cdr"
    assert topics["/imu"].frequency == pytest.approx(300 / 1.99)
    assert topics["/blob"].message_count == 20

    schemas = {schema.name: schema for schema in info.schemas}
    assert schemas["sensor_msgs/msg/Imu"].definition == IMU_DEFINITION
    assert schemas["pkg.Blob"].definition is None

    assert [(a.name, a.media_type, a.size, a.log_time) for a in info.attachments] == [
        ("calibration.yaml", "application/yaml", len(CALIBRATION), START_NS)
    ]


def test_costs_three_requests_and_a_fraction_of_the_file(annotated) -> None:
    url, requests, path = annotated

    info = read_mcap_info_from_url(url)

    # The size probe, then footer, summary and header.
    assert len(requests) == 4
    assert info.message_count == 320
    assert sum(end - start + 1 for start, end in requests[1:]) < path.stat().st_size * 0.1


def test_metadata_records_are_only_read_on_request(annotated) -> None:
    url, requests, _ = annotated

    index_only = read_mcap_info_from_url(url)
    assert [(m.name, m.values) for m in index_only.metadata] == [("robot", None), ("operator", None)]
    index_only_requests = len(requests)
    del requests[:]

    full = read_mcap_info_from_url(url, metadata=True)
    assert [(m.name, m.values) for m in full.metadata] == [
        ("robot", {"name": "anymal-d", "firmware": "24.04"}),
        ("operator", {"name": "test"}),
    ]
    assert len(requests) == index_only_requests + 2


@pytest.mark.parametrize(
    "compression, name, per_message",
    [("NONE", "none", True), ("ZSTD", "zstd", False)],
)
def test_reports_whether_messages_can_be_addressed_one_by_one(
    tmp_path: Path, compression: str, name: str, per_message: bool
) -> None:
    path = tmp_path / "recording.mcap"
    _write_annotated_mcap(path, compression=getattr(mcap_writer.CompressionType, compression))

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.chunk_count > 1
    assert info.compression == {name: info.chunk_count}
    assert info.message_indexed
    assert info._per_message_access is per_message
    assert (info.compressed_size < info.uncompressed_size) is not per_message


def test_chunks_without_message_indexes_cannot_be_addressed_per_message(tmp_path: Path) -> None:
    path = tmp_path / "unindexed.mcap"
    write_mcap(
        path,
        compression=mcap_writer.CompressionType.NONE,
        index_types=mcap_writer.IndexType.ALL & ~mcap_writer.IndexType.MESSAGE,
    )

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.chunk_count > 0
    assert not info.message_indexed
    assert not info._per_message_access
    assert "no message index" in _mcap_chunks_text(info)
    assert info.message_count == len(TOPICS) * MESSAGES_PER_TOPIC


def test_without_statistics_counts_are_unknown_but_the_time_range_is_not(tmp_path: Path) -> None:
    path = tmp_path / "no-statistics.mcap"
    write_mcap(path, compression=mcap_writer.CompressionType.NONE, enable_data_crcs=False, use_statistics=False)

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.message_count is None
    assert [topic.name for topic in info.topics] == sorted(TOPICS)
    assert all(topic.message_count is None and topic.frequency is None for topic in info.topics)
    assert (info.start_time, info.end_time) == (0, (MESSAGES_PER_TOPIC - 1) * INTERVAL_NS)


def test_a_recording_that_was_never_closed_is_reported_as_such(annotated, tmp_path: Path) -> None:
    _, _, path = annotated
    truncated = tmp_path / "truncated.mcap"
    truncated.write_bytes(path.read_bytes()[: path.stat().st_size // 2])

    with serve(truncated) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="cut off"):
            read_mcap_info_from_url(url)


def test_a_file_without_a_summary_section_is_reported_as_such(tmp_path: Path) -> None:
    path = tmp_path / "no-summary.mcap"
    write_mcap(
        path,
        compression=mcap_writer.CompressionType.NONE,
        index_types=mcap_writer.IndexType.NONE,
        use_statistics=False,
        repeat_channels=False,
        repeat_schemas=False,
        use_summary_offsets=False,
    )

    with serve(path) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="no summary section"):
            read_mcap_info_from_url(url)


def test_a_metadata_record_written_twice_is_shown_once(tmp_path: Path) -> None:
    """rosbag2 appends a placeholder at open and the real record at close."""
    path = tmp_path / "rewritten.mcap"
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle)
        writer.start(profile="ros2", library="test")
        writer.add_metadata(name="rosbag2", data={"message_count": "0"})
        writer.add_metadata(name="rosbag2", data={"message_count": "6324"})
        writer.finish()

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url, metadata=True)

    # Nothing is dropped from the data, only from the table.
    assert [m.values for m in info.metadata] == [{"message_count": "0"}, {"message_count": "6324"}]
    assert info.latest_metadata["rosbag2"].values == {"message_count": "6324"}

    console = Console(record=True, width=120)
    console.print(mcap_metadata_table(info))
    output = console.export_text()
    assert "last of 2 records" in output
    assert "message_count: 6324" in output
    assert "message_count: 0" not in output


# --- per-topic coverage --------------------------------------------------------

SECOND = 1_000_000_000
# 20 s at 10 Hz, in chunks of about half a second.
COVERAGE_SECONDS = 20
COVERAGE_HZ = 10


def _write_coverage_mcap(path: Path, *, unindexed_after: Optional[float] = None) -> None:
    """Four topics that each break the whole-recording rate in their own way.

    `unindexed_after` stops writing message indexes that many seconds in, which
    leaves a file whose first chunks are indexed and whose later ones are not.
    """
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, chunk_size=16 * 1024, compression=mcap_writer.CompressionType.NONE)
        writer.start(profile="ros2", library="test")
        schema = writer.register_schema(name="test/Dummy", encoding="jsonschema", data=b"{}")
        channels = {
            topic: writer.register_channel(topic=topic, message_encoding="cdr", schema_id=schema)
            for topic in ("/steady", "/late", "/dropout", "/tf_static")
        }

        for index in range(3):
            writer.add_message(channel_id=channels["/tf_static"], log_time=START_NS + index, data=b"s", publish_time=0)

        for index in range(COVERAGE_SECONDS * COVERAGE_HZ):
            seconds = index / COVERAGE_HZ
            if unindexed_after is not None and seconds >= unindexed_after:
                # Not configurable per chunk; recorders that stop indexing half way
                # (a crash before the index is flushed) leave files just like this.
                writer._Writer__index_types = mcap_writer.IndexType.ALL & ~mcap_writer.IndexType.MESSAGE
            log_time = START_NS + index * SECOND // COVERAGE_HZ
            topics = ["/steady"]
            if seconds >= 10:
                topics.append("/late")
            if seconds < 6 or seconds >= 14:
                topics.append("/dropout")
            for topic in topics:
                writer.add_message(channel_id=channels[topic], log_time=log_time, data=b"x" * 512, publish_time=log_time)
        writer.finish()


@pytest.fixture
def coverage_info(tmp_path: Path) -> McapInfo:
    path = tmp_path / "coverage.mcap"
    _write_coverage_mcap(path)
    with serve(path) as (url, _):
        return read_mcap_info_from_url(url)


def test_a_topic_that_starts_late_is_rated_over_its_own_span(coverage_info: McapInfo) -> None:
    topics = {topic.name: topic for topic in coverage_info.topics}
    late = topics["/late"]

    assert late.message_count == 100
    # Over the whole recording this would be 5 Hz.
    assert late.frequency == pytest.approx(COVERAGE_HZ, rel=0.1)
    assert late.first_seen is not None and late.last_seen is not None
    assert START_NS + 9 * SECOND < late.first_seen <= START_NS + 10 * SECOND
    assert late.last_seen == coverage_info.end_time
    assert late.chunk_count is not None and late.chunk_count >= 5
    assert topics["/steady"].frequency == pytest.approx(COVERAGE_HZ, rel=0.05)

    assert coverage_info.start_time is not None and coverage_info.end_time is not None
    strip = coverage_strip(late.coverage or [], coverage_info.start_time, coverage_info.end_time)
    assert strip == "░" * 9 + "█" * 11 or strip == "░" * 10 + "█" * 10


def test_a_dropout_shows_as_two_covered_spans(coverage_info: McapInfo) -> None:
    dropout = next(topic for topic in coverage_info.topics if topic.name == "/dropout")

    assert dropout.coverage is not None and len(dropout.coverage) == 2
    (first_start, first_end), (second_start, second_end) = dropout.coverage
    assert first_start == coverage_info.start_time
    # Chunk resolution: the spans reach to the edges of the chunks around the
    # dropout, which run long while only /steady fills them.
    assert START_NS + 6 * SECOND <= first_end < START_NS + 8 * SECOND
    assert START_NS + 10 * SECOND < second_start <= START_NS + 14 * SECOND
    assert second_end == coverage_info.end_time

    assert coverage_info.start_time is not None and coverage_info.end_time is not None
    strip = coverage_strip(dropout.coverage, coverage_info.start_time, coverage_info.end_time)
    assert strip.startswith("█" * 6) and strip.endswith("█" * 6)
    assert strip[8:12] == "░" * 4


def test_a_one_shot_topic_has_no_rate(coverage_info: McapInfo) -> None:
    tf_static = next(topic for topic in coverage_info.topics if topic.name == "/tf_static")

    assert tf_static.message_count == 3
    assert tf_static.chunk_count == 1
    assert tf_static.frequency is None
    assert tf_static.first_seen == coverage_info.start_time

    console = Console(record=True, width=200)
    console.print(mcap_topics_table(coverage_info))
    output = console.export_text()
    assert "mean Hz" in output
    assert "coverage  0:00 ─── 0:20" in output
    row = next(line for line in output.splitlines() if "/tf_static" in line)
    assert "—" in row
    # Its one chunk, which runs on past the three messages.
    assert "█" in row and "░" * 18 in row


def test_in_a_file_of_few_chunks_every_topic_keeps_its_rate(tmp_path: Path) -> None:
    """With fewer than five chunks a stream cannot be told from a one-shot topic."""
    path = tmp_path / "short.mcap"
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, compression=mcap_writer.CompressionType.NONE)
        writer.start(profile="ros2", library="test")
        schema = writer.register_schema(name="test/Dummy", encoding="jsonschema", data=b"{}")
        imu = writer.register_channel(topic="/imu", message_encoding="cdr", schema_id=schema)
        once = writer.register_channel(topic="/once", message_encoding="cdr", schema_id=schema)
        writer.add_message(channel_id=once, log_time=START_NS, data=b"o", publish_time=START_NS)
        for index in range(21):
            log_time = START_NS + index * SECOND // 10
            writer.add_message(channel_id=imu, log_time=log_time, data=b"i", publish_time=log_time)
        writer.finish()

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.chunk_count == 1
    topics = {topic.name: topic for topic in info.topics}
    # 21 messages over 2 s, all in the one chunk.
    assert topics["/imu"].frequency == pytest.approx(10.5)
    # A single message has no rate, whatever the file.
    assert topics["/once"].frequency is None


def test_with_some_chunks_unindexed_topic_coverage_is_unknown(tmp_path: Path) -> None:
    path = tmp_path / "half-indexed.mcap"
    _write_coverage_mcap(path, unindexed_after=10)

    with serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert not info.message_indexed
    for topic in info.topics:
        assert topic.message_count is not None
        assert (topic.first_seen, topic.last_seen, topic.chunk_count, topic.coverage) == (None, None, None, None)
        assert topic.frequency is None

    console = Console(record=True, width=200)
    console.print(mcap_topics_table(info))
    output = console.export_text()
    assert "coverage" not in output
    assert "█" not in output and "░" not in output and "—" not in output


def test_a_corrupt_summary_is_refused(annotated, tmp_path: Path) -> None:
    _, _, path = annotated
    data = bytearray(path.read_bytes())
    # The last copy of the schema is the one in the summary section.
    at = data.rindex(b"angular_velocity")
    data[at] ^= 0x20
    corrupt = tmp_path / "corrupt.mcap"
    corrupt.write_bytes(bytes(data))

    with serve(corrupt) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="summary section is corrupt"):
            read_mcap_info_from_url(url)


def test_a_footer_of_the_wrong_length_is_refused(annotated, tmp_path: Path) -> None:
    _, _, path = annotated
    data = bytearray(path.read_bytes())
    # opcode, then the record length, then the 20 bytes of content and the magic
    length_at = len(data) - 8 - 20 - 8
    data[length_at] = 21
    broken = tmp_path / "broken-footer.mcap"
    broken.write_bytes(bytes(data))

    with serve(broken) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="footer record is 21 bytes"):
            read_mcap_info_from_url(url)


def test_format_log_time_keeps_nanoseconds() -> None:
    assert format_log_time(START_NS + 373_212_789) == "2026-09-18T08:08:28.373212789Z"
    assert format_log_time(0) == "1970-01-01T00:00:00.000000000Z"


# --- SDK / CLI integration ---------------------------------------------------


@pytest.fixture
def remote(annotated, monkeypatch) -> File:
    """A remote file whose presigned URL points at the local range server."""
    url, _, path = annotated
    file = remote_file("annotated.mcap", size=path.stat().st_size)
    monkeypatch.setattr(file_transfer, "_get_file_download", lambda client, file_id: url)
    monkeypatch.setattr(kleinkram.api.routes, "get_file", lambda client, query, **kwargs: file)
    return file


def test_sdk_inspect_file(remote: File) -> None:
    info = kleinkram.inspect_file(remote.id, metadata=True, client=MagicMock())

    assert isinstance(info, kleinkram.McapInfo)
    assert info.message_count == 320
    assert info.metadata[0].values == {"name": "anymal-d", "firmware": "24.04"}


def test_inspecting_anything_but_mcap_fails_before_asking_for_a_url(monkeypatch) -> None:
    def fail(*args, **kwargs):
        raise AssertionError("must not request a download url")

    monkeypatch.setattr(file_transfer, "_get_file_download", fail)
    monkeypatch.setattr(kleinkram.api.routes, "get_file", lambda client, query, **kwargs: remote_file("recording.bag"))

    with pytest.raises(FileTypeNotSupported, match="recording.bag"):
        kleinkram.inspect_file(remote_file("recording.bag").id, client=MagicMock())


@pytest.fixture
def cli_app(remote: File, monkeypatch):
    """The real `klein` app, with the API and config layers stubbed out."""
    import kleinkram.cli._file as cli_file
    import kleinkram.cli.app as app_module

    monkeypatch.setattr(app_module, "check_config_compatibility", lambda *args, **kwargs: True)
    monkeypatch.setattr(app_module, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(cli_file, "AuthenticatedClient", MagicMock)
    monkeypatch.setattr(cli_file, "get_file", lambda client, query, **kwargs: remote)
    return app_module.app


def test_cli_inspect_prints_the_summary(cli_app, remote: File) -> None:
    outcome = CliRunner().invoke(cli_app, ["file", "inspect", str(remote.id)], env={"COLUMNS": "200"})

    assert outcome.exit_code == 0, outcome.output
    output = plain(outcome.output)
    assert "mcap summary: annotated.mcap" in output
    assert "2026-09-18T08:08:28.000000000Z" in output
    assert "uncompressed" in output
    assert "partial download" not in output
    assert "transferred" not in output
    assert "/imu sensor_msgs/msg/Imu cdr 300" in output
    assert "calibration.yaml application/yaml" in output
    assert "pass --metadata to read" in output
    assert "float64[3] angular_velocity" not in output


def test_cli_inspect_prints_schemas_and_metadata_on_request(cli_app, remote: File) -> None:
    args = ["file", "inspect", "--schemas", "--metadata", str(remote.id)]
    outcome = CliRunner().invoke(cli_app, args, env={"COLUMNS": "200"})

    assert outcome.exit_code == 0, outcome.output
    output = plain(outcome.output)
    assert "float64[3] angular_velocity" in output
    assert "binary schema" in output
    assert "firmware: 24.04" in output


def test_cli_inspect_emits_json_when_not_verbose(cli_app, remote: File) -> None:
    outcome = CliRunner().invoke(cli_app, ["--no-verbose", "file", "inspect", str(remote.id)])

    assert outcome.exit_code == 0, outcome.output
    payload = json.loads(outcome.output)
    assert payload["id"] == str(remote.id)
    assert payload["start_time"] == START_NS
    assert payload["per_message_access"] is True
    assert payload["duration"] == pytest.approx(1.99)
    assert {topic["name"]: topic["message_count"] for topic in payload["topics"]} == {"/blob": 20, "/imu": 300}
    imu = next(topic for topic in payload["topics"] if topic["name"] == "/imu")
    assert imu["first_seen"] == START_NS
    assert imu["last_seen"] == START_NS + 199 * INTERVAL_NS
    assert imu["chunk_count"] >= 5
    assert imu["coverage"] == [[START_NS, START_NS + 199 * INTERVAL_NS]]
    assert imu["frequency"] == pytest.approx(300 / 1.99)
    for removed in ("bytes_fetched", "requests", "file_size"):
        assert removed not in payload
    assert payload["schemas"][1]["definition"] == IMU_DEFINITION
