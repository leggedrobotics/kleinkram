from __future__ import annotations

from datetime import datetime
from datetime import timezone
from uuid import UUID

import httpx
import pytest

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
from kleinkram.models import File

FILE_ID = UUID("11111111-1111-4111-8111-111111111111")
MISSION_ID = UUID("22222222-2222-4222-8222-222222222222")
OTHER_MISSION_ID = UUID("33333333-3333-4333-8333-333333333333")
PROJECT_ID = UUID("44444444-4444-4444-8444-444444444444")

FILE_DATE = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)


def _file() -> File:
    return File(
        id=FILE_ID,
        name="recording.bag",
        hash="",
        size=0,
        type_="BAG",
        date=FILE_DATE,
        created_at=FILE_DATE,
        updated_at=FILE_DATE,
        mission_id=MISSION_ID,
        mission_name="mission",
        project_id=PROJECT_ID,
        project_name="project",
    )


class _FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"unexpected status: {self.status_code}")


class _FakeClient:
    def __init__(self, status_code=200):
        self.status_code = status_code
        self.puts = []

    def put(self, url, json):
        self.puts.append((url, json))
        return _FakeResponse(self.status_code)


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(kleinkram.api.routes, "get_file_by_id", lambda _client, _id: _file())
    return _FakeClient()


def test_rename_keeps_date_and_mission(client):
    kleinkram.core.update_file(client=client, file_id=FILE_ID, new_name="renamed.bag")

    assert client.puts == [
        (
            f"/files/{FILE_ID}",
            {"uuid": str(FILE_ID), "filename": "renamed.bag", "date": FILE_DATE.isoformat()},
        )
    ]


def test_date_keeps_name(client):
    date = datetime(2025, 6, 1, 8, 30, tzinfo=timezone.utc)
    kleinkram.core.update_file(client=client, file_id=FILE_ID, date=date)

    _, body = client.puts[0]
    assert body["filename"] == "recording.bag"
    assert body["date"] == date.isoformat()


def test_naive_date_is_sent_as_utc(client):
    kleinkram.core.update_file(client=client, file_id=FILE_ID, date=datetime(2025, 6, 1, 8, 30))

    _, body = client.puts[0]
    assert body["date"] == "2025-06-01T08:30:00+00:00"


def test_move_sends_mission(client):
    kleinkram.core.update_file(client=client, file_id=FILE_ID, mission_id=OTHER_MISSION_ID)

    _, body = client.puts[0]
    assert body["missionUuid"] == str(OTHER_MISSION_ID)
    assert body["filename"] == "recording.bag"


def test_nothing_to_update_raises(client):
    with pytest.raises(ValueError):
        kleinkram.core.update_file(client=client, file_id=FILE_ID)
    assert client.puts == []


@pytest.mark.parametrize(
    ("status_code", "error"),
    [(404, kleinkram.errors.FileNotFound), (403, kleinkram.errors.AccessDenied)],
)
def test_error_status_codes(monkeypatch, status_code, error):
    monkeypatch.setattr(kleinkram.api.routes, "get_file_by_id", lambda _client, _id: _file())
    with pytest.raises(error):
        kleinkram.core.update_file(client=_FakeClient(status_code), file_id=FILE_ID, new_name="renamed.bag")


def test_denied_read_raises_access_denied(monkeypatch):
    def denied(_client, file_id):
        request = httpx.Request("GET", f"http://test/files/{file_id}")
        response = httpx.Response(403, request=request)
        raise httpx.HTTPStatusError("forbidden", request=request, response=response)

    monkeypatch.setattr(kleinkram.api.routes, "get_file_by_id", denied)
    client = _FakeClient()
    with pytest.raises(kleinkram.errors.AccessDenied):
        kleinkram.core.update_file(client=client, file_id=FILE_ID, new_name="renamed.bag")
    assert client.puts == []
