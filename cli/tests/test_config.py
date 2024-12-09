from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from kleinkram.config import Config
from kleinkram.config import Endpoint
from kleinkram.config import _load_config
from kleinkram.config import add_endpoint
from kleinkram.config import check_config_compatibility
from kleinkram.config import endpoint_table
from kleinkram.config import get_config
from kleinkram.config import get_env
from kleinkram.config import get_shared_state
from kleinkram.config import save_config
from kleinkram.config import select_endpoint

CONFIG_FILENAME = "kleinkram.json"


@pytest.fixture
def config_path():
    with TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / CONFIG_FILENAME


def test_load_config_default(config_path):
    config = _load_config(path=config_path)

    assert not config_path.exists()
    assert Config() == config


def test_save_and_load_config(config_path):

    config = Config(version="foo")

    assert not config_path.exists()
    save_config(config, path=config_path)
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
