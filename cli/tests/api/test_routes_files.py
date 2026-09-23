from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

import kleinkram.errors
from kleinkram.api.deser import FileObject
from kleinkram.api.deser import _parse_file
from kleinkram.api.query import FileQuery
from kleinkram.api.routes import get_file
from kleinkram.api.routes import get_file_by_id

FILE_UUID = uuid4()
MISSION_UUID = uuid4()
PROJECT_UUID = uuid4()


def _file_payload(*, topics=None):
    payload = {
        "uuid": str(FILE_UUID),
        "filename": "file.bag",
        "date": "2024-01-01T00:00:00.000Z",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "size": 1234,
        "hash": "deadbeef",
        "type": "bag",
        "state": "OK",
        "categories": [{"name": "category"}],
        "mission": {
            "uuid": str(MISSION_UUID),
            "name": "mission",
            "project": {"uuid": str(PROJECT_UUID), "name": "project"},
        },
    }
    if topics is not None:
        payload["topics"] = topics
    return FileObject(payload)


def test_parse_file_without_topics():
    assert _parse_file(_file_payload()).topics == []


def test_parse_file_with_topics():
    topics = [{"name": "/tf", "type": "tf2_msgs/TFMessage"}, {"name": "/imu"}]
    assert _parse_file(_file_payload(topics=topics)).topics == ["/tf", "/imu"]


def _mock_client(response):
    client = MagicMock()
    client.get.return_value = response
    return client


def test_get_file_by_id_returns_topics():
    response = MagicMock(status_code=200)
    response.json.return_value = _file_payload(topics=[{"name": "/tf"}])
    client = _mock_client(response)

    file = get_file_by_id(client, FILE_UUID)

    assert client.get.call_args.args[0] == f"/files/{FILE_UUID}"
    assert file.topics == ["/tf"]


def test_get_file_by_id_not_found():
    client = _mock_client(MagicMock(status_code=404))

    with pytest.raises(kleinkram.errors.FileNotFound):
        get_file_by_id(client, FILE_UUID)


def test_get_file_completes_listed_file_with_topics(monkeypatch):
    # listing files never returns topics, they are fetched from the single file route
    listed = _parse_file(_file_payload())
    monkeypatch.setattr("kleinkram.api.routes.get_files", lambda *_, **__: iter([listed]))

    response = MagicMock(status_code=200)
    response.json.return_value = _file_payload(topics=[{"name": "/tf"}, {"name": "/imu"}])
    client = _mock_client(response)

    file = get_file(client, FileQuery(ids=[FILE_UUID]))

    assert client.get.call_args.args[0] == f"/files/{FILE_UUID}"
    assert file.topics == ["/tf", "/imu"]


def test_get_file_not_found(monkeypatch):
    monkeypatch.setattr("kleinkram.api.routes.get_files", lambda *_, **__: iter([]))
    client = MagicMock()

    with pytest.raises(kleinkram.errors.FileNotFound):
        get_file(client, FileQuery(ids=[FILE_UUID]))

    client.get.assert_not_called()
