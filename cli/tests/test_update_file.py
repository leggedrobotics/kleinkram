from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import UUID

import httpx
import pytest

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors

FILE_ID = UUID("11111111-1111-4111-8111-111111111111")
MISSION_ID = UUID("22222222-2222-4222-8222-222222222222")
OTHER_MISSION_ID = UUID("33333333-3333-4333-8333-333333333333")
PROJECT_ID = UUID("44444444-4444-4444-8444-444444444444")

# the file as `GET /files/:uuid` returns it
FILE_JSON = {
    "uuid": str(FILE_ID),
    "filename": "recording.bag",
    "date": "2026-01-01T12:00:00.000Z",
    "createdAt": "2026-01-01T12:00:00.000Z",
    "updatedAt": "2026-01-01T12:00:00.000Z",
    "size": 0,
    "hash": "",
    "type": "BAG",
    "state": "OK",
    "mission": {
        "uuid": str(MISSION_ID),
        "name": "mission",
        "project": {"uuid": str(PROJECT_ID), "name": "project"},
    },
}
FILE_DATE = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


class _FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "http://test")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("error", request=request, response=response)

    def json(self):
        return self._payload


class _FakeClient:
    def __init__(self, *, get_status=200, put_status=200):
        self.get_status = get_status
        self.put_status = put_status
        self.puts = []

    def get(self, url):
        assert url == f"/files/{FILE_ID}"
        return _FakeResponse(self.get_status, FILE_JSON)

    def put(self, url, json):
        self.puts.append((url, json))
        return _FakeResponse(self.put_status)


def test_rename_keeps_date_and_mission():
    client = _FakeClient()
    kleinkram.core.update_file(client=client, file_id=FILE_ID, new_name="renamed.bag")

    assert client.puts == [
        (
            f"/files/{FILE_ID}",
            {"uuid": str(FILE_ID), "filename": "renamed.bag", "date": FILE_DATE.isoformat()},
        )
    ]


def test_date_keeps_name():
    client = _FakeClient()
    date = datetime(2025, 6, 1, 8, 30, tzinfo=timezone.utc)
    kleinkram.core.update_file(client=client, file_id=FILE_ID, date=date)

    _, body = client.puts[0]
    assert body["filename"] == "recording.bag"
    assert body["date"] == date.isoformat()


def test_naive_date_is_sent_as_utc():
    client = _FakeClient()
    kleinkram.core.update_file(client=client, file_id=FILE_ID, date=datetime(2025, 6, 1, 8, 30))

    _, body = client.puts[0]
    assert body["date"] == "2025-06-01T08:30:00+00:00"


def test_move_keeps_name_and_date():
    client = _FakeClient()
    kleinkram.core.update_file(client=client, file_id=FILE_ID, mission_id=OTHER_MISSION_ID)

    _, body = client.puts[0]
    assert body["missionUuid"] == str(OTHER_MISSION_ID)
    assert body["filename"] == "recording.bag"
    assert body["date"] == FILE_DATE.isoformat()


def test_nothing_to_update_raises():
    client = _FakeClient()
    with pytest.raises(ValueError):
        kleinkram.core.update_file(client=client, file_id=FILE_ID)
    assert client.puts == []


@pytest.mark.parametrize(
    ("status_code", "error"),
    [(404, kleinkram.errors.FileNotFound), (403, kleinkram.errors.AccessDenied)],
)
def test_denied_or_missing_update(status_code, error):
    client = _FakeClient(put_status=status_code)
    with pytest.raises(error):
        kleinkram.core.update_file(client=client, file_id=FILE_ID, new_name="renamed.bag")


@pytest.mark.parametrize(
    ("status_code", "error"),
    [(404, kleinkram.errors.FileNotFound), (403, kleinkram.errors.AccessDenied)],
)
def test_denied_or_missing_read(status_code, error):
    client = _FakeClient(get_status=status_code)
    with pytest.raises(error):
        kleinkram.core.update_file(client=client, file_id=FILE_ID, new_name="renamed.bag")
    assert client.puts == []
