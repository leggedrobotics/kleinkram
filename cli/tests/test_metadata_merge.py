from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import UUID
from uuid import uuid4

import pytest

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.deser import _parse_metadata
from kleinkram.core import _merge_mission_metadata
from kleinkram.core import _metadata_value_to_payload
from kleinkram.core import _validate_tag_value
from kleinkram.errors import InvalidMissionMetadata
from kleinkram.models import MetadataValue
from kleinkram.models import MetadataValueType
from kleinkram.models import Mission

MISSION_ID = UUID("11111111-1111-4111-8111-111111111111")
PROJECT_ID = UUID("22222222-2222-4222-8222-222222222222")


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


def test_metadata_value_to_payload_keeps_native_types():
    assert _metadata_value_to_payload(MetadataValue("alice", MetadataValueType.STRING)) == "alice"
    assert _metadata_value_to_payload(MetadataValue("http://x", MetadataValueType.LINK)) == "http://x"

    # sent as a float, not "42.5": the API parses number *strings* with
    # parseInt, which would truncate a value the caller never touched
    assert _metadata_value_to_payload(MetadataValue("42.5", MetadataValueType.NUMBER)) == 42.5

    assert _metadata_value_to_payload(MetadataValue("true", MetadataValueType.BOOLEAN)) is True
    assert _metadata_value_to_payload(MetadataValue("false", MetadataValueType.BOOLEAN)) is False


def test_merge_mission_metadata_keeps_untouched_fields(monkeypatch):
    existing = {
        "operator": MetadataValue("alice", MetadataValueType.STRING),
        "distance": MetadataValue("42.5", MetadataValueType.NUMBER),
        "indoors": MetadataValue("true", MetadataValueType.BOOLEAN),
    }
    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission(existing),
    )

    merged = _merge_mission_metadata(None, MISSION_ID, {"operator": "bob"})

    assert merged == {"operator": "bob", "distance": 42.5, "indoors": True}


def test_merge_mission_metadata_adds_new_fields(monkeypatch):
    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission({"operator": MetadataValue("alice", MetadataValueType.STRING)}),
    )

    merged = _merge_mission_metadata(None, MISSION_ID, {"weather": "sunny"})

    assert merged == {"operator": "alice", "weather": "sunny"}


def test_merge_mission_metadata_on_empty_mission(monkeypatch):
    monkeypatch.setattr(kleinkram.api.routes, "get_mission", lambda client, query: _mission({}))

    assert _merge_mission_metadata(None, MISSION_ID, {"weather": "sunny"}) == {"weather": "sunny"}


def test_update_mission_sends_the_merged_set(monkeypatch):
    operator_id = uuid4()
    distance_id = uuid4()
    type_ids = {"operator": (operator_id, "STRING"), "distance": (distance_id, "NUMBER")}

    monkeypatch.setattr(
        kleinkram.api.routes,
        "get_mission",
        lambda client, query: _mission(
            {
                "operator": MetadataValue("alice", MetadataValueType.STRING),
                "distance": MetadataValue("42.5", MetadataValueType.NUMBER),
            }
        ),
    )
    monkeypatch.setattr(
        kleinkram.core,
        "_get_metadata_type_id_by_name",
        lambda client, name: type_ids[name],
    )

    sent = {}
    monkeypatch.setattr(
        kleinkram.api.routes,
        "_update_mission",
        lambda client, mission_id, *, tags: sent.update(tags),
    )

    kleinkram.core.update_mission(client=None, mission_id=MISSION_ID, metadata={"operator": "bob"})

    # the untouched NUMBER is re-sent, so the API's full replace keeps it
    assert sent == {operator_id: "bob", distance_id: 42.5}


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
