from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator
from typing import List
from typing import Tuple
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner

import kleinkram
import kleinkram.api.routes
from kleinkram.api import file_transfer
from kleinkram.api.mcap_summary import McapSummaryUnavailable
from kleinkram.api.mcap_summary import read_mcap_info_from_url
from kleinkram.errors import FileTypeNotSupported
from kleinkram.models import File
from kleinkram.printing import format_log_time
from tests.test_mcap_partial_download import INTERVAL_NS
from tests.test_mcap_partial_download import MESSAGES_PER_TOPIC
from tests.test_mcap_partial_download import TOPICS
from tests.test_mcap_partial_download import _plain
from tests.test_mcap_partial_download import _remote_file
from tests.test_mcap_partial_download import _serve
from tests.test_mcap_partial_download import _write_mcap

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
    with _serve(path) as (url, requests):
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
    assert info.requests == 3
    assert info.file_size == path.stat().st_size
    assert info.bytes_fetched == sum(end - start + 1 for start, end in requests[1:])
    assert info.bytes_fetched < info.file_size * 0.1


def test_metadata_records_are_only_read_on_request(annotated) -> None:
    url, requests, _ = annotated

    index_only = read_mcap_info_from_url(url)
    assert [(m.name, m.values) for m in index_only.metadata] == [("robot", None), ("operator", None)]
    del requests[:]

    full = read_mcap_info_from_url(url, metadata=True)
    assert [(m.name, m.values) for m in full.metadata] == [
        ("robot", {"name": "anymal-d", "firmware": "24.04"}),
        ("operator", {"name": "test"}),
    ]
    assert full.requests == index_only.requests + 2


@pytest.mark.parametrize(
    "compression, name, per_message",
    [("NONE", "none", True), ("ZSTD", "zstd", False)],
)
def test_reports_whether_messages_can_be_addressed_one_by_one(
    tmp_path: Path, compression: str, name: str, per_message: bool
) -> None:
    path = tmp_path / "recording.mcap"
    _write_annotated_mcap(path, compression=getattr(mcap_writer.CompressionType, compression))

    with _serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.chunk_count > 1
    assert info.compression == {name: info.chunk_count}
    assert info.message_indexed
    assert info.per_message_access is per_message
    assert (info.compressed_size < info.uncompressed_size) is not per_message


def test_chunks_without_message_indexes_cannot_be_addressed_per_message(tmp_path: Path) -> None:
    path = tmp_path / "unindexed.mcap"
    _write_mcap(
        path,
        compression=mcap_writer.CompressionType.NONE,
        index_types=mcap_writer.IndexType.ALL & ~mcap_writer.IndexType.MESSAGE,
    )

    with _serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.chunk_count > 0
    assert not info.message_indexed
    assert not info.per_message_access
    assert info.message_count == len(TOPICS) * MESSAGES_PER_TOPIC


def test_without_statistics_counts_are_unknown_but_the_time_range_is_not(tmp_path: Path) -> None:
    path = tmp_path / "no-statistics.mcap"
    _write_mcap(path, compression=mcap_writer.CompressionType.NONE, enable_data_crcs=False, use_statistics=False)

    with _serve(path) as (url, _):
        info = read_mcap_info_from_url(url)

    assert info.message_count is None
    assert [topic.name for topic in info.topics] == sorted(TOPICS)
    assert all(topic.message_count is None and topic.frequency is None for topic in info.topics)
    assert (info.start_time, info.end_time) == (0, (MESSAGES_PER_TOPIC - 1) * INTERVAL_NS)


def test_a_recording_that_was_never_closed_is_reported_as_such(annotated, tmp_path: Path) -> None:
    _, _, path = annotated
    truncated = tmp_path / "truncated.mcap"
    truncated.write_bytes(path.read_bytes()[: path.stat().st_size // 2])

    with _serve(truncated) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="cut off"):
            read_mcap_info_from_url(url)


def test_a_file_without_a_summary_section_is_reported_as_such(tmp_path: Path) -> None:
    path = tmp_path / "no-summary.mcap"
    _write_mcap(
        path,
        compression=mcap_writer.CompressionType.NONE,
        index_types=mcap_writer.IndexType.NONE,
        use_statistics=False,
        repeat_channels=False,
        repeat_schemas=False,
        use_summary_offsets=False,
    )

    with _serve(path) as (url, _):
        with pytest.raises(McapSummaryUnavailable, match="no summary section"):
            read_mcap_info_from_url(url)


def test_format_log_time_keeps_nanoseconds() -> None:
    assert format_log_time(START_NS + 373_212_789) == "2026-09-18T08:08:28.373212789Z"
    assert format_log_time(0) == "1970-01-01T00:00:00.000000000Z"


# --- SDK / CLI integration ---------------------------------------------------


@pytest.fixture
def remote(annotated, monkeypatch) -> File:
    """A remote file whose presigned URL points at the local range server."""
    url, _, path = annotated
    file = _remote_file("annotated.mcap", size=path.stat().st_size)
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
    monkeypatch.setattr(kleinkram.api.routes, "get_file", lambda client, query, **kwargs: _remote_file("recording.bag"))

    with pytest.raises(FileTypeNotSupported, match="recording.bag"):
        kleinkram.inspect_file(_remote_file("recording.bag").id, client=MagicMock())


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
    output = _plain(outcome.output)
    assert "mcap summary: annotated.mcap" in output
    assert "2026-09-18T08:08:28.000000000Z" in output
    assert "uncompressed" in output
    assert "--topics and a time window both cut the transfer" in output
    assert "/imu sensor_msgs/msg/Imu cdr 300" in output
    assert "calibration.yaml application/yaml" in output
    assert "pass --metadata to read" in output
    assert "float64[3] angular_velocity" not in output


def test_cli_inspect_prints_schemas_and_metadata_on_request(cli_app, remote: File) -> None:
    args = ["file", "inspect", "--schemas", "--metadata", str(remote.id)]
    outcome = CliRunner().invoke(cli_app, args, env={"COLUMNS": "200"})

    assert outcome.exit_code == 0, outcome.output
    output = _plain(outcome.output)
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
    assert payload["schemas"][1]["definition"] == IMU_DEFINITION
