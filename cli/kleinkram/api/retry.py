"""Retrying HTTP calls: which errors are worth another attempt, and how long to wait.

Retries of the HTTP requests the CLI makes itself go through `Retrier`, so the
rules live in one place (boto3 retries S3 uploads internally):

- Only transient errors are retried (`is_transient`). A 4xx or a local error
  such as `PermissionError` fails the same way on every attempt.
- Waits back off exponentially with jitter, and follow `Retry-After` when the
  server asks for longer.
- With a `cancel_event`, Ctrl+C ends a wait at once (`TransferCancelledError`).
- Log lines never contain a presigned URL (`describe_error`).
"""

from __future__ import annotations

import functools
import logging
import random
import threading
import time
from dataclasses import dataclass
from typing import Callable
from typing import Optional
from typing import TypeVar

import httpx

from kleinkram.errors import TransferCancelledError

logger = logging.getLogger(__name__)

T = TypeVar("T")

# 408 and 429 ask the client to come back later; any other 4xx (expired or
# forbidden URL, missing object, bad range) fails the same way on every retry.
RETRYABLE_CLIENT_STATUS_CODES = frozenset({408, 429})


def is_transient(e: BaseException) -> bool:
    """Network trouble and server-side errors; everything else is final."""
    if isinstance(e, httpx.HTTPStatusError):
        status = e.response.status_code
        return status >= 500 or status in RETRYABLE_CLIENT_STATUS_CODES
    return isinstance(e, httpx.TransportError)


def describe_error(e: BaseException) -> str:
    """A one-line description that is safe to log.

    `str()` of an `HTTPStatusError` contains the request URL, which for storage
    downloads is presigned and carries its signature.
    """
    if isinstance(e, httpx.HTTPStatusError):
        return f"HTTP {e.response.status_code} {e.response.reason_phrase}"
    return str(e) or type(e).__name__


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 5
    """Total attempts, the first one included."""
    backoff_base: float = 2.0
    max_delay: float = 60.0
    """Upper bound for both the backoff and a server's `Retry-After`."""
    jitter: float = 0.5
    retry_on: Callable[[BaseException], bool] = is_transient

    def delay(self, e: BaseException, attempt: int) -> float:
        """Seconds to wait after failed attempt number `attempt` (1-based)."""
        delay = min(self.backoff_base**attempt, self.max_delay) + random.uniform(0, self.jitter)
        if isinstance(e, httpx.HTTPStatusError):
            # Only the delta-seconds form; an HTTP-date falls back to backoff.
            retry_after = e.response.headers.get("Retry-After", "")
            if retry_after.isdigit():
                delay = max(delay, min(float(retry_after), self.max_delay))
        return delay


def _sleep(seconds: float, cancel_event: Optional[threading.Event]) -> bool:
    """Wait, returning True if `cancel_event` was set in the meantime."""
    if cancel_event is None:
        time.sleep(seconds)
        return False
    return cancel_event.wait(seconds)


class Retrier:
    """Counts attempts for one operation and waits between them.

    For a plain call, use `call`. A loop that keeps state between attempts
    (a download that resumes where it stopped) uses the parts directly::

        retrier = Retrier(POLICY, cancel_event=cancel_event)
        while not done:
            try:
                ...
                retrier.reset()  # progress was made
            except Exception as e:
                if not retrier.record_failure(e):
                    raise
                retrier.wait(e)

    Not thread-safe: use one per operation.
    """

    def __init__(
        self,
        policy: RetryPolicy,
        *,
        cancel_event: Optional[threading.Event] = None,
        name: str = "request",
    ) -> None:
        self.policy = policy
        self.cancel_event = cancel_event
        self.name = name
        self.attempt = 0

    def reset(self) -> None:
        """Start counting again, e.g. after a download made progress."""
        self.attempt = 0

    def record_failure(self, e: BaseException) -> bool:
        """Count a failed attempt; return True if another one is worth making.

        A cancelled transfer is never retried, whatever the policy says.
        """
        self.attempt += 1
        if isinstance(e, TransferCancelledError):
            return False
        return self.policy.retry_on(e) and self.attempt < self.policy.max_attempts

    def wait(self, e: BaseException) -> None:
        """Back off before the next attempt; raise `TransferCancelledError` on Ctrl+C."""
        delay = self.policy.delay(e, self.attempt)
        logger.warning(
            f"{self.name} failed ({describe_error(e)}), "
            f"attempt {self.attempt}/{self.policy.max_attempts}; retrying in {delay:.1f}s"
        )
        if _sleep(delay, self.cancel_event):
            raise TransferCancelledError("Transfer cancelled by user")

    def call(self, fn: Callable[..., T], *args, **kwargs) -> T:
        """Call `fn` until it succeeds or fails with an error that is final.

        The last error is re-raised unchanged, so callers can still catch it
        by type.
        """
        while True:
            try:
                return fn(*args, **kwargs)
            except Exception as e:
                if not self.record_failure(e):
                    raise
                self.wait(e)


def retrying(policy: RetryPolicy) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator form of `Retrier.call`, for calls that need no cancel_event."""

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(fn)
        def wrapper(*args, **kwargs) -> T:
            return Retrier(policy, name=fn.__name__).call(fn, *args, **kwargs)

        return wrapper

    return decorator
