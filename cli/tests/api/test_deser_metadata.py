"""\
servers renamed the mission `tags` to `metadata` and the project `requiredTags`
to `requiredMetadataTypes`; the CLI has to read both so it keeps working
against servers from before the rename
"""

from __future__ import annotations

import json
import warnings
from uuid import uuid4

import pytest

from kleinkram.api.deser import _parse_mission
from kleinkram.api.deser import _parse_project
from kleinkram.api.routes import _create_mission
from kleinkram.printing import print_project_info

NOW = "2026-01-01T00:00:00.000Z"
TYPE_ID = str(uuid4())


def _metadata(name: str, value: str):
    return [{"name": name, "datatype": "STRING", "value": value, "type": {"uuid": TYPE_ID}}]


def _project(**extra):
    return {
        "uuid": str(uuid4()),
        "name": "p1",
        "description": "",
        "createdAt": NOW,
        "updatedAt": NOW,
        **extra,
    }


def _mission(**extra):
    return {
        "uuid": str(uuid4()),
        "name": "m1",
        "createdAt": NOW,
        "updatedAt": NOW,
        "size": 0,
        "filesCount": 0,
        "project": {"uuid": str(uuid4()), "name": "p1"},
        **extra,
    }


def test_parse_mission_reads_metadata():
    mission = _parse_mission(_mission(metadata=_metadata("robot", "anymal")))
    assert mission.metadata["robot"].value == "anymal"


def test_parse_mission_falls_back_to_legacy_tags():
    mission = _parse_mission(_mission(tags=_metadata("robot", "anymal")))
    assert mission.metadata["robot"].value == "anymal"


def test_parse_mission_prefers_metadata_over_legacy_tags():
    mission = _parse_mission(_mission(metadata=_metadata("robot", "new"), tags=_metadata("robot", "old")))
    assert mission.metadata["robot"].value == "new"


def test_parse_project_reads_required_metadata_types():
    project = _parse_project(_project(requiredMetadataTypes=_metadata("robot", "")))
    assert project.required_metadata_types == ["robot"]


def test_parse_project_falls_back_to_legacy_required_tags():
    project = _parse_project(_project(requiredTags=_metadata("robot", "")))
    assert project.required_metadata_types == ["robot"]


def test_parse_project_prefers_required_metadata_types_over_legacy_key():
    project = _parse_project(_project(requiredMetadataTypes=_metadata("new", ""), requiredTags=_metadata("old", "")))
    assert project.required_metadata_types == ["new"]


def test_project_required_tags_is_a_deprecated_alias():
    project = _parse_project(_project(requiredMetadataTypes=_metadata("robot", "")))

    with pytest.warns(DeprecationWarning, match="required_metadata_types"):
        assert project.required_tags == ["robot"]

    with warnings.catch_warnings():
        warnings.simplefilter("error")
        assert project.required_metadata_types == ["robot"]


def test_project_info_json_keeps_the_legacy_key(capsys):
    project = _parse_project(_project(requiredMetadataTypes=_metadata("robot", "")))

    print_project_info(project, pprint=False)

    printed = json.loads(capsys.readouterr().out)
    assert printed["required_metadata_types"] == ["robot"]
    assert printed["required_tags"] == ["robot"]


class _RecordingClient:
    def __init__(self):
        self.payload = None

    def post(self, url, json):
        self.payload = json
        return self

    def raise_for_status(self):
        pass

    def json(self):
        return {"uuid": str(uuid4())}


def test_create_mission_sends_the_names_every_server_accepts():
    """\
    servers before the rename require `tags` and reject unknown fields, newer
    servers accept `tags`/`ignoreTags` as deprecated aliases
    """
    client = _RecordingClient()
    type_id = uuid4()

    _create_mission(client, uuid4(), "m1", metadata={type_id: "anymal"}, ignore_missing_metadata=True)

    assert client.payload["tags"] == {str(type_id): "anymal"}
    assert client.payload["ignoreTags"] is True
    assert "metadata" not in client.payload
    assert "ignoreMissingMetadata" not in client.payload
