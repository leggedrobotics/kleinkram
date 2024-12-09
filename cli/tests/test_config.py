from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from kleinkram.config import Config
from kleinkram.config import _load_config
from kleinkram.config import get_config
from kleinkram.config import get_shared_state
from kleinkram.config import save_config

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
