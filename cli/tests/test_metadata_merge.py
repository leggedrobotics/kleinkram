from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import UUID
from uuid import uuid4

import pytest

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.deser import _parse_metadata
from kleinkram.core import _get_metadata_type_id_by_name
from kleinkram.core import _merge_mission_metadata
from kleinkram.core import _metadata_value_to_payload
from kleinkram.core import _validate_tag_value
from kleinkram.errors import InvalidMissionMetadata
from kleinkram.models import MetadataValue
from kleinkram.models import MetadataValueType
from kleinkram.models import Mission

MISSION_ID = UUID("11111111-1111-4111-8111-111111111111")
PROJECT_ID = UUID("22222222-2222-4222-8222-222222222222")

CPU_ID = UUID("33333333-3333-4333-8333-333333333333")
CPU_CORES_ID = UUID("44444444-4444-4444-8444-444444444444")


def _mission(metadata):
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    return Mission(
        id=MISSION_ID,
        name="mission",
        created_at=now,
        updated_at=now,
        project_id=PROJECT_ID,
        project_name="project",
        metadata=metadata,
    )


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"unexpected status: {self.status_code}")

    def json(self):
        return self._payload


class _FakeMetadataTypeClient:
    """\
    stands in for the API's `/metadata-types/filtered`, which matches the name
    as a case-insensitive substring
    """

    def __init__(self, types, count=None):
        self.types = types
        self._count = count

    def get(self, url, params=None):
        assert url == "/metadata-types/filtered"
        needle = (params or {}).get("name", "").lower()
        take = (params or {}).get("take", 100)
        data = [entry for entry in self.types if needle in entry["name"].lower()]
        count = self._count if self._count is not None else len(data)
        return _FakeResponse({"data": data[:take], "count": count})


CPU_TYPES = [
    {"uuid": str(CPU_CORES_ID), "name": "cpu_cores", "datatype": "NUMBER"},
    {"uuid": str(CPU_ID), "name": "cpu", "datatype": "STRING"},
]


def test_parse_metadata_falls_back_to_value_key():
    """`valueAsString` is a getter on the API DTO and is not serialized (#2360)."""
    parsed = _parse_metadata(
        [
            {"name": "operator", "datatype": "STRING", "value": "alice"},
            {"name": "distance", "datatype": "NUMBER", "value": 42.5},
            {"name": "indoors", "datatype": "BOOLEAN", "value": False},
        ]
    )

    assert parsed["operator"] == MetadataValue("alice", "STRING")
    assert parsed["distance"] == MetadataValue("42.5", "NUMBER")
    # not "False" — neither the API nor `parse_metadata_value` understands that
    assert parsed["indoors"] == MetadataValue("false", "BOOLEAN")


def test_parse_metadata_prefers_value_as_string_when_present():
    parsed = _parse_metadata([{"name": "operator", "datatype": "STRING", "valueAsString": "bob"}])
    assert parsed["operator"] == MetadataValue("bob", "STRING")


def test_parse_metadata_handles_missing_value():
    parsed = _parse_metadata([{"name": "operator", "datatype": "STRING"}])
    assert parsed["operator"] == MetadataValue("", "STRING")


def test_parse_metadata_keeps_the_metadata_type_id():
    parsed = _parse_metadata(
        [
            {"name": "cpu", "datatype": "STRING", "value": "amd", "type": {"uuid": str(CPU_ID)}},
            # the raw entity spells it `tagType`
            {"name": "cpu_cores", "datatype": "NUMBER", "value": 8, "tagType": {"uuid": str(CPU_CORES_ID)}},
        ]
    )

    assert parsed["cpu"].type_id == CPU_ID
    assert parsed["cpu_cores"].type_id == CPU_CORES_ID


def test_parse_metadata_without_a_type_id():
    parsed = _parse_metadata([{"name": "operator", "datatype": "STRING", "value": "alice"}])
    assert parsed["operator"].type_id is None


def test_metadata_value_to_payload_keeps_native_types():
    assert _metadata_value_to_payload(MetadataValue("alice", MetadataValueType.STRING)) == "alice"
    assert _metadata_value_to_payload(MetadataValue("http://x", MetadataValueType.LINK)) == "http://x"

    # sent as a float, not "42.5": the API parses number *strings* with
    # parseInt, which would truncate a value the caller never touched
    assert _metadata_value_to_payload(MetadataValue("42.5", MetadataValueType.NUMBER)) == 42.5

    assert _metadata_value_to_payload(MetadataValue("true", MetadataValueType.BOOLEAN)) is True
    assert _metadata_value_to_payload(MetadataValue("false", MetadataValueType.BOOLEAN)) is False


def test_get_metadata_type_id_by_name_requires_an_exact_match():
    client = _FakeMetadataTypeClient(CPU_TYPES)

    # `cpu` matches `cpu_cores` as a substring, and `cpu_cores` is listed first
    assert _get_metadata_type_id_by_name(client, "cpu") == (CPU_ID, "STRING")
    assert _get_metadata_type_id_by_name(client, "cpu_cores") == (CPU_CORES_ID, "NUMBER")


def test_get_metadata_type_id_by_name_falls_back_to_case_insensitive_equality():
    # the server compares names case-insensitively, so `CPU` must still
    # resolve to `cpu` -- but never to the substring match `cpu_cores`
    client = _FakeMetadataTypeClient(CPU_TYPES)
    assert _get_metadata_type_id_by_name(client, "CPU") == (CPU_ID, "STRING")


def test_get_metadata_type_id_by_name_prefers_exact_case_over_case_insensitive():
    client = _FakeMetadataTypeClient(
        [
            {"uuid": str(CPU_ID), "name": "cpu", "datatype": "STRING"},
            {"uuid": str(CPU_CORES_ID), "name": "CPU", "datatype": "NUMBER"},
        ]
    )
    assert _get_metadata_type_id_by_name(client, "CPU") == (CPU_CORES_ID, "NUMBER")
    assert _get_metadata_type_id_by_name(client, "cpu") == (CPU_ID, "STRING")


def test_get_metadata_type_id_by_name_reports_ambiguity():
    client = _FakeMetadataTypeClient(
        [
            {"uuid": str(CPU_ID), "name": "cpu", "datatype": "STRING"},
            {"uuid": str(CPU_CORES_ID), "name": "cpu", "datatype": "NUMBER"},
        ]
    )

    with pytest.raises(InvalidMissionMetadata, match="ambiguous"):
        _get_metadata_type_id_by_name(client, "cpu")


def test_get_metadata_type_id_by_name_reports_truncated_results():
    # more matches than the page we fetched, and none of them exact
    client = _FakeMetadataTypeClient([{"uuid": str(CPU_ID), "name": "cpu_cores", "datatype": "NUMBER"}], count=5000)

    with pytest.raises(InvalidMissionMetadata, match="too many"):
        _get_metadata_type_id_by_name(client, "cpu")


def test_merge_mission_metadata_keeps_untouched_fields(monkeypatch):
    operator_id = uuid4()
    distance_id = uuid4()
    indoors_id = uuid4()

    existing = {
        "operator": MetadataValue("alice", MetadataValueType.STRING, operator_id),
        "distance": MetadataValue("42.5", MetadataValueType.NUMBER, distance_id),
        "indoors": MetadataValue("true", MetadataValueType.BOOLEAN, indoors_id),
    }
    monkeypatch.setattr(kleinkram.api.routes, "get_mission", lambda client, query: _mission(existing))
    monkeypatch.setattr(
        kleinkram.core,
        "_get_metadata_type_id_by_name",
        lambda client, name: (operator_id, "STRING"),
    )

    merged = _merge_mission_metadata(None, MISSION_ID, {"operator": "bob"})

    assert merged == {operator_id: "bob", distance_id: 42.5, indoors_id: True}


def test_merge_mission_metadata_does_not_confuse_prefixed_names(monkeypatch):
    """`cpu` must not be re-resolved into `cpu_cores` by the substring search."""
    existing = {
        "cpu": MetadataValue("amd", MetadataValueType.STRING, CPU_ID),
        "cpu_cores": MetadataValue("8", MetadataValueType.NUMBER, CPU_CORES_ID),
    }
    monkeypatch.setattr(kleinkram.api.routes, "get_mission", lambda client, query: _mission(existing))

    client = _FakeMetadataTypeClient(CPU_TYPES)

    # only `cpu_cores` is touched; `cpu` is carried over by uuid
    merged = _merge_mission_metadata(client, MISSION_ID, {"cpu_cores": "16"})

    assert merged == {CPU_CORES_ID: "16", CPU_ID: "amd"}


def test_merge_mission_metadata_adds_new_fields(monkeypatch):
    operator_id = uuid4()
    weather_id = uuid4()

    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission({"operator": MetadataValue("alice", MetadataValueType.STRING, operator_id)}),
    )
    monkeypatch.setattr(
        kleinkram.core,
        "_get_metadata_type_id_by_name",
        lambda client, name: (weather_id, "STRING"),
    )

    merged = _merge_mission_metadata(None, MISSION_ID, {"weather": "sunny"})

    assert merged == {operator_id: "alice", weather_id: "sunny"}


def test_merge_mission_metadata_on_empty_mission(monkeypatch):
    weather_id = uuid4()

    monkeypatch.setattr(kleinkram.api.routes, "get_mission", lambda client, query: _mission({}))
    monkeypatch.setattr(
        kleinkram.core,
        "_get_metadata_type_id_by_name",
        lambda client, name: (weather_id, "STRING"),
    )

    assert _merge_mission_metadata(None, MISSION_ID, {"weather": "sunny"}) == {weather_id: "sunny"}


def test_merge_mission_metadata_falls_back_to_an_exact_name_lookup(monkeypatch):
    """a server that does not report the type uuid still resolves — exactly."""
    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission({"cpu": MetadataValue("amd", MetadataValueType.STRING)}),
    )

    client = _FakeMetadataTypeClient(CPU_TYPES)
    assert _merge_mission_metadata(client, MISSION_ID, {}) == {CPU_ID: "amd"}


def test_merge_mission_metadata_fails_when_a_field_cannot_be_resolved(monkeypatch):
    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission({"gone": MetadataValue("alice", MetadataValueType.STRING)}),
    )

    client = _FakeMetadataTypeClient(CPU_TYPES)
    with pytest.raises(InvalidMissionMetadata, match="cannot resolve"):
        _merge_mission_metadata(client, MISSION_ID, {})


def test_update_mission_sends_the_merged_set(monkeypatch):
    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission(
            {
                "cpu": MetadataValue("amd", MetadataValueType.STRING, CPU_ID),
                "cpu_cores": MetadataValue("8.5", MetadataValueType.NUMBER, CPU_CORES_ID),
            }
        ),
    )

    sent = {}
    monkeypatch.setattr(
        kleinkram.api.routes,
        "_update_mission",
        lambda client, mission_id, *, tags: sent.update(tags),
    )

    client = _FakeMetadataTypeClient(CPU_TYPES)
    kleinkram.core.update_mission(client=client, mission_id=MISSION_ID, metadata={"cpu": "intel"})

    # the untouched NUMBER is re-sent as a float, so the API's full replace
    # keeps it without running it through parseInt
    assert sent == {CPU_ID: "intel", CPU_CORES_ID: 8.5}


def test_validate_tag_value_accepts_native_types():
    _validate_tag_value(42.5, "NUMBER")
    _validate_tag_value(42, "NUMBER")
    _validate_tag_value("42.5", "NUMBER")
    _validate_tag_value(True, "BOOLEAN")
    _validate_tag_value(False, "BOOLEAN")
    _validate_tag_value("true", "BOOLEAN")

    with pytest.raises(InvalidMissionMetadata):
        _validate_tag_value("nope", "NUMBER")
    with pytest.raises(InvalidMissionMetadata):
        _validate_tag_value("nope", "BOOLEAN")
