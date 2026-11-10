"""Which download errors `_url_download` retries, and which it gives up on at once."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Callable
from typing import List

import httpx
import pytest

from kleinkram.api import file_transfer
from kleinkram.api import retry
from kleinkram.errors import AccessDenied

URL = "https://s3.example.com/bucket/file.mcap?X-Amz-Signature=secret"
CONTENT = b"0123456789"


@pytest.fixture
def sleeps(monkeypatch) -> List[float]:
    """Record backoff delays instead of sleeping."""
    recorded: List[float] = []

    def fake_sleep(seconds: float, cancel_event) -> bool:
        recorded.append(seconds)
        return False

    monkeypatch.setattr(retry, "_sleep", fake_sleep)
    return recorded


def serve(monkeypatch, handler: Callable[[httpx.Request], httpx.Response]) -> List[httpx.Request]:
    """Answer the `httpx.stream` calls in `_url_download` with `handler`."""
    requests: List[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return handler(request)

    @contextmanager
    def stream(method, url, **kwargs):
        with httpx.Client(transport=httpx.MockTransport(record)) as client:
            with client.stream(method, url, **kwargs) as response:
                yield response

    monkeypatch.setattr(file_transfer.httpx, "stream", stream)
    return requests


def download(path: Path) -> None:
    file_transfer._url_download(URL, path=path, size=len(CONTENT))


@pytest.mark.parametrize("status", [401, 403])
def test_access_denied_fails_without_retrying(tmp_path: Path, monkeypatch, sleeps, status: int) -> None:
    requests = serve(monkeypatch, lambda _: httpx.Response(status))

    with pytest.raises(AccessDenied) as exc:
        download(tmp_path / "file.mcap")

    assert len(requests) == 1
    assert sleeps == []
    assert "secret" not in str(exc.value)


@pytest.mark.parametrize("status", [400, 404, 416])
def test_other_client_errors_fail_without_retrying(tmp_path: Path, monkeypatch, sleeps, status: int) -> None:
    requests = serve(monkeypatch, lambda _: httpx.Response(status))

    with pytest.raises(RuntimeError, match=f"HTTP {status}"):
        download(tmp_path / "file.mcap")

    assert len(requests) == 1
    assert sleeps == []


def test_unwritable_target_fails_without_retrying(tmp_path: Path, monkeypatch, sleeps) -> None:
    requests = serve(monkeypatch, lambda _: httpx.Response(200, content=CONTENT))

    with pytest.raises(FileNotFoundError):
        download(tmp_path / "missing-dir" / "file.mcap")

    assert len(requests) == 1
    assert sleeps == []


@pytest.mark.parametrize("status", [500, 503, 408, 429])
def test_transient_status_is_retried_then_succeeds(tmp_path: Path, monkeypatch, sleeps, status: int) -> None:
    responses = iter([httpx.Response(status), httpx.Response(200, content=CONTENT)])
    requests = serve(monkeypatch, lambda _: next(responses))
    path = tmp_path / "file.mcap"

    download(path)

    assert len(requests) == 2
    assert len(sleeps) == 1
    assert path.read_bytes() == CONTENT


def test_network_error_is_retried(tmp_path: Path, monkeypatch, sleeps) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if len(sleeps) == 0:
            raise httpx.ConnectError("connection refused", request=request)
        return httpx.Response(200, content=CONTENT)

    serve(monkeypatch, handler)
    path = tmp_path / "file.mcap"

    download(path)

    assert len(sleeps) == 1
    assert path.read_bytes() == CONTENT


def test_persistent_server_error_gives_up_after_max_retries(tmp_path: Path, monkeypatch, sleeps, caplog) -> None:
    requests = serve(monkeypatch, lambda _: httpx.Response(503))

    with pytest.raises(RuntimeError, match="after 6 attempts: HTTP 503") as exc:
        download(tmp_path / "file.mcap")

    assert len(requests) == file_transfer.DOWNLOAD_RETRY.max_attempts
    assert len(sleeps) == file_transfer.DOWNLOAD_RETRY.max_attempts - 1
    assert "secret" not in str(exc.value)
    assert "secret" not in caplog.text


@pytest.mark.parametrize("final_status, error_type", [(403, AccessDenied), (404, RuntimeError)])
def test_final_error_on_the_last_attempt_keeps_its_own_message(
    tmp_path: Path, monkeypatch, sleeps, final_status: int, error_type: type
) -> None:
    transient = [httpx.Response(503)] * (file_transfer.DOWNLOAD_RETRY.max_attempts - 1)
    responses = iter(transient + [httpx.Response(final_status)])
    serve(monkeypatch, lambda _: next(responses))

    with pytest.raises(error_type, match=f"HTTP {final_status}") as exc:
        download(tmp_path / "file.mcap")

    assert "attempts" not in str(exc.value)


def test_retry_after_is_honoured_and_capped(tmp_path: Path, monkeypatch, sleeps) -> None:
    responses = iter(
        [
            httpx.Response(429, headers={"Retry-After": "30"}),
            httpx.Response(429, headers={"Retry-After": "3600"}),
            httpx.Response(200, content=CONTENT),
        ]
    )
    serve(monkeypatch, lambda _: next(responses))

    download(tmp_path / "file.mcap")

    assert sleeps == [30, file_transfer.DOWNLOAD_RETRY.max_delay]
