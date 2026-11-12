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


def test_device_login_reports_old_servers(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    monkeypatch.setattr(
        kleinkram.auth,
        "_device_client",
        lambda api: httpx.Client(base_url=api, transport=httpx.MockTransport(handler)),
    )
    with pytest.raises(kleinkram.auth.DeviceLoginUnsupported):
        _device_auth(api="https://api.example.org", open_browser=False, sleep=lambda _: None)


def test_old_server_falls_back_to_token_paste_without_browser(monkeypatch, tmp_path):
    from kleinkram.config import Config
    from kleinkram.config import Credentials
    from kleinkram.config import Endpoint

    config = Config(endpoints={"old": Endpoint("old", "https://api.old.org", "s3")}, selected_endpoint="old")
    monkeypatch.setattr(kleinkram.auth, "get_config", lambda: config)
    monkeypatch.setattr(kleinkram.auth, "save_config", lambda c: None)
    monkeypatch.setattr(kleinkram.auth, "_print_signed_in", lambda c: None)
    monkeypatch.setattr(kleinkram.auth, "_has_browser", lambda: False)

    def no_device_login(**kwargs):
        raise kleinkram.auth.DeviceLoginUnsupported()

    urls: List[str] = []

    def legacy(*, url):
        urls.append(url)
        return Credentials(auth_token="a", refresh_token="r")

    monkeypatch.setattr(kleinkram.auth, "_device_auth", no_device_login)
    monkeypatch.setattr(kleinkram.auth, "_legacy_headless_auth", legacy)

    kleinkram.auth.login_flow(oAuthProvider="github")

    assert urls == ["https://api.old.org/auth/github?state=cli-no-redirect"]
    assert config.credentials == Credentials(auth_token="a", refresh_token="r")


def test_add_server_drops_login_of_a_replaced_server(monkeypatch):
    from kleinkram.config import Config
    from kleinkram.config import Credentials
    from kleinkram.config import Endpoint
    from kleinkram.discovery import ServerInfo

    config = Config(
        endpoints={"datasets.example.org": Endpoint("datasets.example.org", "https://api.old.org", "s3")},
        endpoint_credentials={"datasets.example.org": Credentials(api_key="secret")},
        selected_endpoint="datasets.example.org",
    )
    monkeypatch.setattr(kleinkram.config, "save_config", lambda c, path=None: None)
    monkeypatch.setattr(
        kleinkram.auth,
        "discover",
        lambda url: ServerInfo(
            frontend_url="https://datasets.example.org",
            api_url="https://api.new.org",
            s3_url="https://s3.new.org",
            server_version="0.67.0",
            min_cli_version="0.58.0",
            auth_providers=[],
            device_flow=True,
        ),
    )

    kleinkram.auth.add_server("datasets.example.org", config=config)

    assert config.endpoint.api == "https://api.new.org"
    assert "datasets.example.org" not in config.endpoint_credentials


def test_add_server_keeps_login_of_the_same_server(monkeypatch):
    from kleinkram.config import Config
    from kleinkram.config import Credentials
    from kleinkram.config import Endpoint
    from kleinkram.discovery import ServerInfo

    config = Config(
        endpoints={"prod": Endpoint("prod", "https://api.example.org", "s3")},
        endpoint_credentials={"prod": Credentials(api_key="secret")},
        selected_endpoint="prod",
    )
    monkeypatch.setattr(kleinkram.config, "save_config", lambda c, path=None: None)
    monkeypatch.setattr(
        kleinkram.auth,
        "discover",
        lambda url: ServerInfo(
            frontend_url="https://datasets.example.org",
            api_url="https://api.example.org",
            s3_url="https://s3.example.org",
            server_version="0.67.0",
            min_cli_version="0.58.0",
            auth_providers=[],
            device_flow=True,
        ),
    )

    kleinkram.auth.add_server("datasets.example.org", config=config)

    assert config.selected_endpoint == "prod"
    assert config.endpoint_credentials["prod"] == Credentials(api_key="secret")
