from __future__ import annotations

import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

import pytest

import kleinkram.config
from kleinkram.config import ACTION_API
from kleinkram.config import ACTION_API_KEY
from kleinkram.config import ACTION_S3
from kleinkram.config import Config
from kleinkram.config import Endpoint
from kleinkram.config import _load_config
from kleinkram.config import _load_config_if_compatible
from kleinkram.config import add_endpoint
from kleinkram.config import check_config_compatibility
from kleinkram.config import endpoint_table
from kleinkram.config import get_config
from kleinkram.config import get_env
from kleinkram.config import get_shared_state
from kleinkram.config import save_config
from kleinkram.config import select_endpoint

CONFIG_FILENAME = ".kleinkram.json"


TEST_API_KEY = "test_key"
TEST_API = "test_api"
TEST_S3 = "test_s3"


@pytest.fixture()
def set_api_key_env(monkeypatch):
    with mock.patch.dict(os.environ, clear=True):
        envvars = {ACTION_API_KEY: TEST_API_KEY}
        for k, v in envvars.items():
            monkeypatch.setenv(k, v)
        yield  # This is the magical bit which restore the environment after


@pytest.fixture()
def set_endpoint_env(monkeypatch):
    with mock.patch.dict(os.environ, clear=True):
        envvars = {ACTION_API: TEST_API, ACTION_S3: TEST_S3}
        for k, v in envvars.items():
            monkeypatch.setenv(k, v)
        yield  # This is the magical bit which restore the environment after


@pytest.fixture
def config_path():
    with TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / CONFIG_FILENAME


def test_load_config_if_compatible_with_invalid_config(config_path):
    with open(config_path, "w") as f:
        f.write("this is not a valid config")
    assert _load_config_if_compatible(config_path) is None


def test_load_config_default(config_path):
    config = _load_config(path=config_path)

    assert not config_path.exists()
    assert Config() == config

    assert config.endpoint_credentials == {}
    assert config.selected_endpoint == get_env().value


def test_load_default_config_with_env_var_api_key_specified(
    config_path, set_api_key_env
):
    assert set_api_key_env is None

    config = _load_config(path=config_path)

    creds = config.endpoint_credentials[config.selected_endpoint]
    assert creds.auth_token is None
    assert creds.refresh_token is None
    assert creds.api_key == TEST_API_KEY

    assert not config_path.exists()


def test_load_default_config_with_env_var_endpoints_specified(
    config_path, set_endpoint_env
):
    assert set_endpoint_env is None
    config = _load_config(path=config_path)

    assert config.selected_endpoint == "action"
    assert config.endpoint == Endpoint("action", TEST_API, TEST_S3)

    assert not config_path.exists()


def test_save_and_load_config(config_path):
    config = Config(version="foo")

    assert not config_path.exists()
    with mock.patch.object(kleinkram.config.logger, "debug") as mock_debug:
        save_config(config, path=config_path)
        mock_debug.assert_not_called()

    assert config_path.exists()
    loaded_config = _load_config(path=config_path)
    assert loaded_config == config


def test_save_and_load_config_when_tmpfile_fails(config_path):
    config = Config(version="foo")

    assert not config_path.exists()
    with mock.patch("tempfile.mkstemp", side_effect=Exception), mock.patch.object(
        kleinkram.config.logger, "debug"
    ) as mock_debug:
        save_config(config, path=config_path)
        mock_debug.assert_called_once()

    assert config_path.exists()
    loaded_config = _load_config(path=config_path)
    assert loaded_config == config


def test_get_config_default(config_path):
    config = get_config(path=config_path)

    assert not config_path.exists()
    assert Config() == config
    assert config is get_config(path=config_path)


def test_get_config_after_save(config_path):
    config = get_config(path=config_path)
    config.version = "foo"
    save_config(config, path=config_path)

    assert config is get_config(path=config_path)


def test_get_shared_state():
    state = get_shared_state()
    assert state is get_shared_state()


def test_select_endpoint(config_path):
    config = get_config(path=config_path)
    save_config(config, path=config_path)
    assert config.selected_endpoint == get_env().value

    # select existing endpoint
    select_endpoint(config, "prod", path=config_path)
    assert config.selected_endpoint == "prod"
    assert config == _load_config(path=config_path)

    with pytest.raises(ValueError):
        select_endpoint(config, "foo", path=config_path)


def test_add_endpoint(config_path):
    config = get_config(path=config_path)
    save_config(config, path=config_path)
    assert config.selected_endpoint == get_env().value

    with pytest.raises(ValueError):
        select_endpoint(config, "foo", path=config_path)

    ep = Endpoint("foo", "api", "s3")
    add_endpoint(config, ep, path=config_path)
    assert config.selected_endpoint == "foo"
    assert config.endpoint == ep
    assert config == _load_config(path=config_path)

    select_endpoint(config, "dev", path=config_path)
    assert config.selected_endpoint == "dev"
    select_endpoint(config, "foo", path=config_path)
    assert config.selected_endpoint == "foo"


def test_endpoint_table():
    config = Config()
    table = endpoint_table(config)

    assert [c.header for c in table.columns] == ["Name", "API", "S3"]
    assert len(table.rows) == 3


def test_check_config_compatiblity(config_path):
    assert check_config_compatibility(path=config_path)
    with open(config_path, "w") as f:
        f.write("foo")  # invalid config
    assert not check_config_compatibility(path=config_path)
