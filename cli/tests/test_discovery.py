from __future__ import annotations

import json

import httpx
import pytest

from kleinkram.discovery import discover
from kleinkram.discovery import host_name
from kleinkram.discovery import is_version_supported
from kleinkram.discovery import normalize_url
from kleinkram.errors import ServerDiscoveryError

CLI_CONFIG = {
    "frontendUrl": "https://datasets.example.org",
    "apiUrl": "https://api.datasets.example.org",
    "s3Url": "https://s3.datasets.example.org",
    "serverVersion": "0.67.0",
    "minCliVersion": "0.58.0",
    "authProviders": ["github"],
    "deviceFlow": True,
    "docsUrl": "https://docs.datasets.example.org",
}


def _client(routes):
    def handler(request: httpx.Request) -> httpx.Response:
        key = f"{request.url.scheme}://{request.url.host}{request.url.path}"
        if key in routes:
            return httpx.Response(200, content=json.dumps(routes[key]))
        return httpx.Response(404)

    return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.mark.parametrize(
    "typed, expected",
    [
        ("datasets.example.org", "https://datasets.example.org"),
        ("https://datasets.example.org/projects/abc?x=1", "https://datasets.example.org"),
        ("http://datasets.example.org/", "http://datasets.example.org"),
        ("localhost:8003", "http://localhost:8003"),
        ("127.0.0.1:3000/", "http://127.0.0.1:3000"),
        ("  datasets.example.org  ", "https://datasets.example.org"),
    ],
)
def test_normalize_url(typed, expected):
    assert normalize_url(typed) == expected


@pytest.mark.parametrize("typed", ["", "ftp://example.org", "https://"])
def test_normalize_url_rejects_invalid(typed):
    with pytest.raises(ServerDiscoveryError):
        normalize_url(typed)


def test_host_name():
    assert host_name("https://datasets.example.org/files") == "datasets.example.org"
    assert host_name("localhost:8003") == "localhost:8003"


def test_discover_from_web_app_address():
    client = _client(
        {
            "https://datasets.example.org/.well-known/kleinkram.json": {"apiUrl": "https://api.datasets.example.org"},
            "https://api.datasets.example.org/cli/config": CLI_CONFIG,
        }
    )
    info = discover("datasets.example.org", client=client)
    assert info.api_url == "https://api.datasets.example.org"
    assert info.s3_url == "https://s3.datasets.example.org"
    assert info.frontend_url == "https://datasets.example.org"
    assert info.auth_providers == ["github"]
    assert info.device_flow


def test_discover_from_api_address():
    client = _client({"https://api.datasets.example.org/cli/config": CLI_CONFIG})
    info = discover("https://api.datasets.example.org", client=client)
    assert info.api_url == "https://api.datasets.example.org"


def test_discover_fails_for_unknown_server():
    client = _client({})
    with pytest.raises(ServerDiscoveryError, match="Could not find a Kleinkram server"):
        discover("example.org", client=client)


@pytest.mark.parametrize(
    "cli, minimum, supported",
    [
        ("0.67.0", "0.58.0", True),
        ("0.58.0", "0.58.0", True),
        ("0.57.9", "0.58.0", False),
        ("0.67.0.dev20260101", "0.67.0", True),
        ("1.0.0", "0.99.0", True),
    ],
)
def test_is_version_supported(cli, minimum, supported):
    assert is_version_supported(cli, minimum) is supported
