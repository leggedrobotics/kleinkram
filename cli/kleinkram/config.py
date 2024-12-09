"""
this file contains a global config and a global state object

to get the config use `get_config()`
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from typing import Any
from typing import Dict
from typing import NamedTuple
from typing import Optional

from kleinkram._version import __local__
from kleinkram._version import __version__

logger = logging.getLogger(__name__)

CONFIG_PATH = Path().home() / ".kleinkram.json"


class Environment(Enum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


class Endpoint(NamedTuple):
    name: str
    api: str
    s3: str


class Credentials(NamedTuple):
    auth_token: Optional[str] = None
    refresh_token: Optional[str] = None
    cli_key: Optional[str] = None


DEFAULT_LOCAL_API = "http://localhost:3000"
DEFAULT_LOCAL_S3 = "http://localhost:9000"

DEFAULT_DEV_API = "https://api.datasets.dev.leggedrobotics.com"
DEFAULT_DEV_S3 = "https://s3.datasets.dev.leggedrobotics.com"

DEFAULT_PROD_API = "https://api.datasets.leggedrobotics.com"
DEFAULT_PROD_S3 = "https://s3.datasets.leggedrobotics.com"


DEFAULT_ENDPOINTS = {
    "local": Endpoint("local", DEFAULT_LOCAL_API, DEFAULT_LOCAL_S3),
    "dev": Endpoint("dev", DEFAULT_DEV_API, DEFAULT_DEV_S3),
    "prod": Endpoint("prod", DEFAULT_PROD_API, DEFAULT_PROD_S3),
}


def get_env() -> Environment:
    if __local__:
        return Environment.LOCAL
    if "dev" in __version__:
        return Environment.DEV
    return Environment.PROD


@dataclass
class Config:
    version: str = __version__
    selected_endpoint: str = field(default_factory=lambda: get_env().value)
    endpoints: Dict[str, Endpoint] = field(
        default_factory=lambda: DEFAULT_ENDPOINTS.copy()
    )
    endpoint_credentials: Dict[str, Credentials] = field(default_factory=dict)

    @property
    def endpoint(self) -> Endpoint:
        return self.endpoints[self.selected_endpoint]

    @endpoint.setter
    def endpoint(self, value: Endpoint) -> None:
        self.endpoints[self.selected_endpoint] = value

    @property
    def credentials(self) -> Optional[Credentials]:
        return self.endpoint_credentials.get(self.selected_endpoint)

    @credentials.setter
    def credentials(self, value: Credentials) -> None:
        self.endpoint_credentials[self.selected_endpoint] = value


def _config_to_dict(config: Config) -> Dict[str, Any]:
    return {
        "version": config.version,
        "endpoints": {key: value._asdict() for key, value in config.endpoints.items()},
        "endpoint_credentials": {
            key: value._asdict() for key, value in config.endpoint_credentials.items()
        },
        "selected_endpoint": config.endpoint.name,
    }


def _config_from_dict(dct: Dict[str, Any]) -> Config:
    return Config(
        dct["version"],
        dct["selected_endpoint"],
        {key: Endpoint(**value) for key, value in dct["endpoints"].items()},
        {
            key: Credentials(**value)
            for key, value in dct["endpoint_credentials"].items()
        },
    )


def save_config(config: Config, path: Path = CONFIG_PATH) -> None:
    fd, temp_path = tempfile.mkstemp()
    with os.fdopen(fd, "w") as f:
        json.dump(_config_to_dict(config), f)
    os.replace(temp_path, path)


def _load_config(*, path: Path = CONFIG_PATH) -> Config:
    if not path.exists():
        return Config()
    with open(path, "r") as f:
        return _config_from_dict(json.load(f))


LOADED_CONFIGS: Dict[Path, Config] = {}


def get_config(path: Path = CONFIG_PATH) -> Config:
    if path not in LOADED_CONFIGS:
        LOADED_CONFIGS[path] = _load_config(path=path)
    return LOADED_CONFIGS[path]


@dataclass
class SharedState:
    log_file: Optional[Path] = None
    verbose: bool = True
    debug: bool = False


SHARED_STATE = SharedState()


def get_shared_state() -> SharedState:
    return SHARED_STATE
