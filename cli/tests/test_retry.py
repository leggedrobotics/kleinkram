"""The shared retry helper in `kleinkram.api.retry`."""

from __future__ import annotations

import threading
from typing import List
from typing import Optional

import httpx
import pytest

from kleinkram.api import retry
from kleinkram.api.range_reader import HttpRangeReader
from kleinkram.api.retry import Retrier
from kleinkram.api.retry import RetryPolicy
from kleinkram.api.retry import describe_error
from kleinkram.api.retry import is_transient
from kleinkram.api.retry import retrying
from kleinkram.errors import TransferCancelledError

URL = "https://s3.example.com/bucket/file?X-Amz-Signature=secret"
NO_JITTER = RetryPolicy(max_attempts=4, jitter=0)


def status_error(status: int, headers: Optional[dict] = None) -> httpx.HTTPStatusError:
    request = httpx.Request("GET", URL)
    response = httpx.Response(status, headers=headers, request=request)
    return httpx.HTTPStatusError(f"error for url {URL}", request=request, response=response)


@pytest.fixture
def sleeps(monkeypatch) -> List[float]:
    recorded: List[float] = []

    def fake_sleep(seconds: float, cancel_event: Optional[threading.Event]) -> bool:
        recorded.append(seconds)
        return cancel_event is not None and cancel_event.is_set()

    monkeypatch.setattr(retry, "_sleep", fake_sleep)
    return recorded


@pytest.mark.parametrize(
    "error, transient",
    [
        (httpx.ConnectError("refused"), True),
        (httpx.ReadTimeout("timed out"), True),
        (httpx.RemoteProtocolError("peer closed connection"), True),
        (status_error(500), True),
        (status_error(503), True),
        (status_error(408), True),
        (status_error(429), True),
        (status_error(400), False),
        (status_error(401), False),
        (status_error(403), False),
        (status_error(404), False),
        (PermissionError("denied"), False),
        (ValueError("bug"), False),
    ],
)
def test_is_transient(error: Exception, transient: bool) -> None:
    assert is_transient(error) is transient


def test_describe_error_leaves_out_the_url() -> None:
    assert describe_error(status_error(403)) == "HTTP 403 Forbidden"
    assert describe_error(httpx.ConnectError("refused")) == "refused"


def test_backoff_grows_and_is_capped() -> None:
    policy = RetryPolicy(backoff_base=2, max_delay=10, jitter=0)
    assert [policy.delay(httpx.ConnectError(""), n) for n in range(1, 6)] == [2, 4, 8, 10, 10]


def test_jitter_never_pushes_a_wait_past_max_delay(monkeypatch) -> None:
    monkeypatch.setattr(retry.random, "uniform", lambda low, high: high)  # the largest jitter
    policy = RetryPolicy(backoff_base=2, max_delay=10, jitter=0.5)

    assert [policy.delay(httpx.ConnectError(""), n) for n in range(1, 5)] == [2.5, 4.5, 8.5, 10]
    assert policy.delay(status_error(429, {"Retry-After": "3600"}), 1) == 10


def test_retry_after_raises_the_delay_but_is_capped() -> None:
    policy = RetryPolicy(max_delay=60, jitter=0)
    assert policy.delay(status_error(429, {"Retry-After": "30"}), 1) == 30
    assert policy.delay(status_error(429, {"Retry-After": "3600"}), 1) == 60
    # Shorter than the backoff, or an HTTP-date: the backoff wins.
    assert policy.delay(status_error(503, {"Retry-After": "0"}), 3) == 8
    assert policy.delay(status_error(503, {"Retry-After": "Wed, 21 Oct 2015 07:28:00 GMT"}), 1) == 2


def test_call_retries_transient_errors_until_success(sleeps) -> None:
    outcomes = [httpx.ConnectError("refused"), status_error(502), "ok"]

    def flaky() -> str:
        outcome = outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    assert Retrier(NO_JITTER).call(flaky) == "ok"
    assert sleeps == [2, 4]


def test_call_reraises_a_final_error_unchanged(sleeps) -> None:
    error = status_error(404)

    def missing() -> None:
        raise error

    with pytest.raises(httpx.HTTPStatusError) as exc:
        Retrier(NO_JITTER).call(missing)

    assert exc.value is error
    assert sleeps == []


def test_call_gives_up_after_max_attempts(sleeps) -> None:
    calls = []

    def down() -> None:
        calls.append(1)
        raise httpx.ConnectError("refused")

    with pytest.raises(httpx.ConnectError):
        Retrier(NO_JITTER).call(down)

    assert len(calls) == NO_JITTER.max_attempts
    assert len(sleeps) == NO_JITTER.max_attempts - 1


def test_reset_starts_counting_again(sleeps) -> None:
    retrier = Retrier(RetryPolicy(max_attempts=2, jitter=0))
    error = httpx.ConnectError("refused")

    assert retrier.record_failure(error)
    retrier.reset()
    assert retrier.record_failure(error)
    assert not retrier.record_failure(error)


def test_cancel_event_ends_the_wait(sleeps) -> None:
    cancel = threading.Event()

    def down() -> None:
        cancel.set()  # Ctrl+C arrives while the request is failing
        raise httpx.ConnectError("refused")

    with pytest.raises(TransferCancelledError):
        Retrier(NO_JITTER, cancel_event=cancel).call(down)

    assert len(sleeps) == 1


def test_cancelled_transfer_is_never_retried(sleeps) -> None:
    def cancelled() -> None:
        raise TransferCancelledError("Transfer cancelled by user")

    with pytest.raises(TransferCancelledError):
        Retrier(NO_JITTER).call(cancelled)

    assert sleeps == []


def test_real_wait_returns_early_on_cancel() -> None:
    cancel = threading.Event()
    cancel.set()
    assert retry._sleep(60, cancel) is True


def test_decorator_keeps_name_and_retries(sleeps) -> None:
    attempts = []

    @retrying(NO_JITTER)
    def confirm(value: int) -> int:
        attempts.append(value)
        if len(attempts) < 2:
            raise status_error(500)
        return value * 2

    assert confirm(21) == 42
    assert confirm.__name__ == "confirm"
    assert attempts == [21, 21]


def test_range_reader_retries_a_dropped_range_request(sleeps) -> None:
    content = bytes(range(256)) * 4
    failures = {"left": 2}

    def handler(request: httpx.Request) -> httpx.Response:
        start, end = (int(x) for x in request.headers["Range"].removeprefix("bytes=").split("-"))
        if start > 0 and failures["left"] > 0:
            failures["left"] -= 1
            raise httpx.ReadError("connection reset", request=request)
        stop = end + 1
        headers = {"Content-Range": f"bytes {start}-{end}/{len(content)}"}
        return httpx.Response(206, headers=headers, content=content[start:stop])

    reader = HttpRangeReader(URL, client=httpx.Client(transport=httpx.MockTransport(handler)), block_size=256)

    assert reader.read_exact(512, 100) == content[512:612]
    assert len(sleeps) == 2


def test_range_reader_does_not_retry_forbidden(sleeps) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(403)

    with pytest.raises(httpx.HTTPStatusError):
        HttpRangeReader(URL, client=httpx.Client(transport=httpx.MockTransport(handler)))

    assert sleeps == []
