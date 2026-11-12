from __future__ import annotations

import json
from typing import List

import httpx
import pytest

import kleinkram.auth
from kleinkram.auth import LoginFailed
from kleinkram.auth import _device_auth

AUTHORIZATION = {
    "deviceCode": "secret-device-code",
    "userCode": "KQMX-TRBC",
    "verificationUri": "https://datasets.example.org/cli/activate",
    "verificationUriComplete": "https://datasets.example.org/cli/activate?code=KQMX-TRBC",
    "expiresIn": 600,
    "interval": 5,
}


def _patch_server(monkeypatch, poll_results: List[dict], requests: List[httpx.Request]):
    results = iter(poll_results)

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path == "/cli/device":
            return httpx.Response(200, content=json.dumps(AUTHORIZATION))
        if request.url.path == "/cli/device/token":
            return httpx.Response(200, content=json.dumps(next(results)))
        return httpx.Response(404)

    def client(api: str) -> httpx.Client:
        return httpx.Client(base_url=api, transport=httpx.MockTransport(handler))

    monkeypatch.setattr(kleinkram.auth, "_device_client", client)


def test_device_login_returns_tokens_after_approval(monkeypatch):
    requests: List[httpx.Request] = []
    _patch_server(
        monkeypatch,
        [
            {"status": "pending"},
            {"status": "slow_down"},
            {"status": "approved", "authToken": "auth", "refreshToken": "refresh"},
        ],
        requests,
    )
    sleeps: List[float] = []

    credentials = _device_auth(api="https://api.example.org", open_browser=False, sleep=sleeps.append)

    assert credentials.auth_token == "auth"
    assert credentials.refresh_token == "refresh"
    # slow_down makes the CLI wait longer
    assert sleeps == [5, 5, 10]

    start = json.loads(requests[0].content)
    assert set(start) == {"hostname", "platform", "cliVersion"}
    poll = json.loads(requests[1].content)
    assert poll == {"deviceCode": "secret-device-code"}


@pytest.mark.parametrize("status, message", [("denied", "denied"), ("expired", "expired")])
def test_device_login_fails_when_denied_or_expired(monkeypatch, status, message):
    _patch_server(monkeypatch, [{"status": status}], [])
    with pytest.raises(LoginFailed, match=message):
        _device_auth(api="https://api.example.org", open_browser=False, sleep=lambda _: None)


def test_device_login_opens_browser_with_code(monkeypatch):
    _patch_server(monkeypatch, [{"status": "approved", "authToken": "a", "refreshToken": "r"}], [])
    opened: List[str] = []
    monkeypatch.setattr(kleinkram.auth.webbrowser, "open", lambda url: opened.append(url) or True)

    _device_auth(api="https://api.example.org", open_browser=True, sleep=lambda _: None)
    assert opened == [AUTHORIZATION["verificationUriComplete"]]


def test_no_browser_over_ssh_without_display(monkeypatch):
    monkeypatch.setattr(kleinkram.auth.sys, "platform", "linux")
    monkeypatch.delenv("DISPLAY", raising=False)
    monkeypatch.delenv("WAYLAND_DISPLAY", raising=False)
    assert not kleinkram.auth._has_browser()
