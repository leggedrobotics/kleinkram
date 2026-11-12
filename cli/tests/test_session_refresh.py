from __future__ import annotations

import json
import os
import stat
from pathlib import Path
from typing import List

import httpx
import pytest

import kleinkram.config
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import Config
from kleinkram.config import Credentials
from kleinkram.config import Endpoint
from kleinkram.config import _load_config
from kleinkram.config import save_config
from kleinkram.config import update_saved_credentials


@pytest.fixture
def config_path(tmp_path: Path):
    path = tmp_path / ".kleinkram.json"
    config = Config(
        endpoints={"local": Endpoint("local", "http://localhost:3000", "http://localhost:9000")},
        endpoint_credentials={"local": Credentials(auth_token="old-access", refresh_token="ks1.r0")},
        selected_endpoint="local",
    )
    save_config(config, path)
    kleinkram.config.LOADED_CONFIGS.pop(path, None)
    yield path
    kleinkram.config.LOADED_CONFIGS.pop(path, None)


def test_config_file_is_private(config_path: Path):
    assert stat.S_IMODE(os.stat(config_path).st_mode) == 0o600


def test_refresh_saves_the_rotated_refresh_token(config_path: Path):
    seen: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.url.path == "/auth/refresh-token":
            return httpx.Response(
                200,
                headers=[
                    ("set-cookie", "authtoken=new-access; Path=/"),
                    ("set-cookie", "refreshtoken=ks1.r1; Path=/; HttpOnly"),
                ],
                json={"message": "Token refreshed"},
            )
        if "authtoken=new-access" in request.headers.get("cookie", ""):
            return httpx.Response(200, json={})
        return httpx.Response(401)

    with AuthenticatedClient(config_path=config_path, transport=httpx.MockTransport(handler)) as client:
        assert client.get("/users/me").status_code == 200

    saved = _load_config(path=config_path).endpoint_credentials["local"]
    assert saved == Credentials(auth_token="new-access", refresh_token="ks1.r1")
    refresh_request = next(r for r in seen if r.url.path == "/auth/refresh-token")
    assert "refreshtoken=ks1.r0" in refresh_request.headers["cookie"]


def test_refresh_uses_tokens_another_process_already_refreshed(config_path: Path):
    paths: List[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        paths.append(request.url.path)
        if "authtoken=other-access" in request.headers.get("cookie", ""):
            return httpx.Response(200, json={})
        return httpx.Response(401)

    with AuthenticatedClient(config_path=config_path, transport=httpx.MockTransport(handler)) as client:
        # another `klein` process rotates the tokens while this one runs
        on_disk = json.loads(config_path.read_text())
        on_disk["endpoint_credentials"]["local"] = {
            "auth_token": "other-access",
            "refresh_token": "ks1.r1",
            "api_key": None,
        }
        config_path.write_text(json.dumps(on_disk))

        assert client.get("/users/me").status_code == 200

    # the already rotated refresh token was not presented again
    assert "/auth/refresh-token" not in paths


def test_update_saved_credentials_keeps_other_endpoints(config_path: Path):
    on_disk = json.loads(config_path.read_text())
    on_disk["endpoints"]["other"] = {"name": "other", "api": "https://api.example.org", "s3": "s3"}
    on_disk["endpoint_credentials"]["other"] = {"auth_token": None, "refresh_token": None, "api_key": "k"}
    config_path.write_text(json.dumps(on_disk))

    update_saved_credentials("local", lambda _: None, config_path)

    saved = _load_config(path=config_path)
    assert "local" not in saved.endpoint_credentials
    assert saved.endpoint_credentials["other"].api_key == "k"
