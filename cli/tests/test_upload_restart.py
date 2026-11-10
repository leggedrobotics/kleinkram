"""When an upload, or the request that starts it, is tried again."""

from __future__ import annotations

import threading
from pathlib import Path
from typing import List
from typing import Optional
from unittest.mock import MagicMock
from uuid import uuid4

import httpx
import pytest
from botocore.exceptions import ClientError

from kleinkram.api import file_transfer
from kleinkram.api import retry
from kleinkram.api.file_transfer import UploadState
from kleinkram.api.retry import is_unsent


@pytest.fixture
def sleeps(monkeypatch) -> List[float]:
    recorded: List[float] = []

    def fake_sleep(seconds: float, cancel_event: Optional[threading.Event]) -> bool:
        recorded.append(seconds)
        return cancel_event is not None and cancel_event.is_set()

    monkeypatch.setattr(retry, "_sleep", fake_sleep)
    return recorded


# --- requesting upload credentials ---------------------------------------------


@pytest.mark.parametrize(
    "error, unsent",
    [
        (httpx.ConnectError("refused"), True),
        (httpx.ConnectTimeout("timed out"), True),
        (httpx.PoolTimeout("no free connection"), True),
        (httpx.ReadTimeout("timed out"), False),
        (httpx.WriteTimeout("timed out"), False),
        (httpx.RemoteProtocolError("peer closed connection"), False),
    ],
)
def test_is_unsent(error: Exception, unsent: bool) -> None:
    assert is_unsent(error) is unsent


def credentials_response() -> httpx.Response:
    data = {
        "bucket": "bucket",
        "fileUUID": str(uuid4()),
        "accessCredentials": {"accessKey": "k", "secretKey": "s", "sessionToken": "t"},
    }
    return httpx.Response(201, json={"data": [data]}, request=httpx.Request("POST", "http://api/files/temporaryAccess"))


def request_credentials(client: MagicMock) -> file_transfer.UploadCredentials:
    return file_transfer._get_upload_creditials(client, internal_filename="a.mcap", mission_id=uuid4(), file_size=1)


def test_credentials_are_requested_again_when_the_connection_failed(sleeps) -> None:
    client = MagicMock()
    client.post.side_effect = [httpx.ConnectError("refused"), credentials_response()]

    creds = request_credentials(client)

    assert creds.bucket == "bucket"
    assert client.post.call_count == 2


@pytest.mark.parametrize("error", [httpx.ReadTimeout("timed out"), httpx.RemoteProtocolError("peer closed")])
def test_credentials_are_not_requested_again_when_the_server_may_have_reserved_the_file(sleeps, error) -> None:
    # A second request would get 409 and report the file as already uploaded.
    client = MagicMock()
    client.post.side_effect = [error, credentials_response()]

    with pytest.raises(type(error)):
        request_credentials(client)

    assert client.post.call_count == 1
    assert sleeps == []


def test_existing_file_is_reported_without_retrying(sleeps) -> None:
    client = MagicMock()
    client.post.return_value = httpx.Response(409, request=httpx.Request("POST", "http://api/files/temporaryAccess"))

    with pytest.raises(FileExistsError):
        request_credentials(client)

    assert client.post.call_count == 1


# --- restarting an upload after boto3 gave up ----------------------------------


@pytest.fixture
def upload(tmp_path: Path, monkeypatch):
    """Run `upload_file` with S3 replaced by `s3_outcomes`, one per attempt."""
    path = tmp_path / "a.mcap"
    path.write_bytes(b"x" * 10)
    calls = {"credentials": 0, "s3": 0}
    cancel = MagicMock()
    confirm = MagicMock()

    def credentials(*args, **kwargs) -> file_transfer.UploadCredentials:
        calls["credentials"] += 1
        return file_transfer.UploadCredentials("k", "s", "t", uuid4(), "bucket")

    monkeypatch.setattr(file_transfer, "_get_upload_creditials", credentials)
    monkeypatch.setattr(file_transfer, "_cancel_file_upload", cancel)
    monkeypatch.setattr(file_transfer, "_confirm_file_upload", confirm)

    def run(s3_outcomes: List[Optional[Exception]], cancel_event: Optional[threading.Event] = None):
        outcomes = iter(s3_outcomes)

        def s3_upload(*args, **kwargs) -> None:
            calls["s3"] += 1
            outcome = next(outcomes)
            if outcome is not None:
                raise outcome

        monkeypatch.setattr(file_transfer, "_s3_upload", s3_upload)
        state = file_transfer.upload_file(
            MagicMock(),
            mission_id=uuid4(),
            filename="a.mcap",
            path=path,
            s3_endpoint="http://unused",
            cancel_event=cancel_event,
        )
        return state, calls, cancel, confirm

    return run


def s3_error(code: str) -> ClientError:
    return ClientError({"Error": {"Code": code, "Message": code}}, "PutObject")


def test_upload_restarts_with_fresh_credentials(upload, sleeps) -> None:
    state, calls, cancel, confirm = upload([s3_error("ExpiredToken"), None])

    assert state == (UploadState.UPLOADED, 10)
    assert calls == {"credentials": 2, "s3": 2}
    assert cancel.call_count == 1  # the first, failed attempt is released
    confirm.assert_called_once()
    assert len(sleeps) == 1


def test_upload_gives_up_after_the_restart_limit(upload, sleeps) -> None:
    attempts = file_transfer.UPLOAD_RESTART_RETRY.max_attempts

    with pytest.raises(ClientError):
        upload([s3_error("InternalError")] * attempts)

    assert len(sleeps) == attempts - 1


@pytest.mark.parametrize("error", [PermissionError("denied"), FileNotFoundError("gone")])
def test_unreadable_local_file_is_not_restarted(upload, sleeps, error) -> None:
    with pytest.raises(type(error)):
        upload([error, None])

    assert sleeps == []


def test_ctrl_c_during_the_wait_cancels_the_upload(upload, monkeypatch) -> None:
    cancel_event = threading.Event()

    def ctrl_c_while_waiting(seconds: float, event: Optional[threading.Event]) -> bool:
        cancel_event.set()
        return True

    monkeypatch.setattr(retry, "_sleep", ctrl_c_while_waiting)

    state, calls, _cancel, confirm = upload([s3_error("InternalError")], cancel_event=cancel_event)

    assert state == (UploadState.CANCELED, 0)
    assert calls["s3"] == 1
    confirm.assert_not_called()
