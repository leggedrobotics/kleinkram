from __future__ import annotations

import datetime

import pytest

from kleinkram.models import FileState
from kleinkram.models import FileVerificationStatus
from kleinkram.models import MetadataValue
from kleinkram.models import MetadataValueType
from kleinkram.printing import file_state_to_text
from kleinkram.printing import file_verification_status_to_text
from kleinkram.printing import format_bytes
from kleinkram.printing import parse_metadata_value


def test_format_bytes():
    assert format_bytes(0) == "0 B"
    assert format_bytes(1) == "1 B"
    assert format_bytes(1000) == "1000 B"
    assert format_bytes(1024) == "1.00 KB"
    assert format_bytes(1025) == "1.00 KB"
    assert format_bytes(2048) == "2.00 KB"
    assert format_bytes(2**20) == "1.00 MB"
    assert format_bytes(2**30) == "1.00 GB"
    assert format_bytes(2**40) == "1.00 TB"
    assert format_bytes(2**50) == "1.00 PB"


def test_parse_metadata_value():
    mv = MetadataValue(type_=MetadataValueType.STRING, value="foo")
    assert parse_metadata_value(mv) == "foo"
    mv = MetadataValue(type_=MetadataValueType.LINK, value="foo")
    assert parse_metadata_value(mv) == "foo"
    mv = MetadataValue(type_=MetadataValueType.LOCATION, value="foo")
    assert parse_metadata_value(mv) == "foo"
    mv = MetadataValue(type_=MetadataValueType.NUMBER, value="1")
    assert parse_metadata_value(mv) == 1.0
    mv = MetadataValue(type_=MetadataValueType.BOOLEAN, value="true")
    assert parse_metadata_value(mv) is True  # noqa
    mv = MetadataValue(type_=MetadataValueType.BOOLEAN, value="false")
    assert parse_metadata_value(mv) is False  # noqa
    mv = MetadataValue(type_=MetadataValueType.DATE, value="2021-01-01T00:00:00Z")
    assert parse_metadata_value(mv) == datetime.datetime(
        2021, 1, 1, 0, 0, 0, tzinfo=datetime.timezone.utc
    )


@pytest.mark.skip
def test_projects_to_table(): ...


@pytest.mark.skip
def test_missions_to_table(): ...


@pytest.mark.skip
def test_files_to_table(): ...


@pytest.mark.skip
def test_mission_info_table(): ...


@pytest.mark.skip
def test_project_info_table(): ...
