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

from rich.table import Table
from rich.text import Text

from kleinkram._version import __local__
from kleinkram._version import __version__
from kleinkram.utils import format_traceback

logger = logging.getLogger(__name__)

CONFIG_PATH = Path().home() / ".kleinkram.json"
MAX_TABLE_SIZE = 256


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
    api_key: Optional[str] = None


DEFAULT_LOCAL_API = "http://localhost:3000"
DEFAULT_LOCAL_S3 = "http://localhost:9000"

DEFAULT_DEV_API = "https://api.datasets.dev.leggedrobotics.com"
DEFAULT_DEV_S3 = "https://minio.datasets.dev.leggedrobotics.com"

DEFAULT_PROD_API = "https://api.datasets.leggedrobotics.com"
DEFAULT_PROD_S3 = "https://minio.datasets.leggedrobotics.com"


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


ACTION_API_KEY = "KLEINKRAM_API_KEY"
ACTION_API = "KLEINKRAM_API_ENDPOINT"
ACTION_S3 = "KLEINKRAM_S3_ENDPOINT"


def _get_endpoint_from_action_env_vars() -> Optional[Endpoint]:
    api = os.getenv(ACTION_API)
    s3 = os.getenv(ACTION_S3)
    if api is None or s3 is None:
        return None
    return Endpoint("action", api, s3)


def _get_api_key_from_action_env_vars() -> Optional[str]:
    return os.getenv(ACTION_API_KEY)


def _get_default_selected_endpoint() -> Endpoint:
    env_endpoint = _get_endpoint_from_action_env_vars()
    if env_endpoint is not None:
        return env_endpoint
    return DEFAULT_ENDPOINTS[get_env().value]


def _get_default_endpoints() -> Dict[str, Endpoint]:
    env_endpoint = _get_endpoint_from_action_env_vars()

    default_endpoints = DEFAULT_ENDPOINTS.copy()
    if env_endpoint is not None:
        default_endpoints["action"] = env_endpoint
    return default_endpoints


def _get_default_credentials() -> Dict[str, Credentials]:
    endpoint = _get_default_selected_endpoint()

    api_key = _get_api_key_from_action_env_vars()
    if api_key is not None:
        return {endpoint.name: Credentials(api_key=api_key)}
    return {}


@dataclass
class Config:
    version: str = __version__
    selected_endpoint: str = field(
        default_factory=lambda: _get_default_selected_endpoint().name
    )
    endpoints: Dict[str, Endpoint] = field(default_factory=_get_default_endpoints)
    endpoint_credentials: Dict[str, Credentials] = field(
        default_factory=_get_default_credentials
    )

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


def _safe_config_write(
    config: Config, path: Path, tmp_dir: Optional[Path] = None
) -> None:
    fd, temp_path = tempfile.mkstemp(dir=tmp_dir)
    with os.fdopen(fd, "w") as f:
        json.dump(_config_to_dict(config), f)
    os.replace(temp_path, path)


def _unsafe_config_write(config: Config, path: Path) -> None:
    with open(path, "w") as f:
        json.dump(_config_to_dict(config), f)


def save_config(config: Config, path: Path = CONFIG_PATH) -> None:
    try:
        _safe_config_write(config, path)
    except Exception as e:
        logger.debug(f"failed to safe write config {format_traceback(e)}")
        _unsafe_config_write(config, path)


def _load_config_if_compatible(path: Path) -> Optional[Config]:
    if not path.exists():
        return None
    with open(path, "r") as f:
        try:
            return _config_from_dict(json.load(f))
        except Exception:
            return None


def _load_config(*, path: Path = CONFIG_PATH) -> Config:
    config = _load_config_if_compatible(path)
    if config is None:
        return Config()
    return config


LOADED_CONFIGS: Dict[Path, Config] = {}


def get_config(path: Path = CONFIG_PATH) -> Config:
    if path not in LOADED_CONFIGS:
        LOADED_CONFIGS[path] = _load_config(path=path)
    return LOADED_CONFIGS[path]


def select_endpoint(config: Config, name: str, path: Path = CONFIG_PATH) -> None:
    if name not in config.endpoints:
        raise ValueError(f"Endpoint {name} not found.")
    config.selected_endpoint = name
    save_config(config, path)


def add_endpoint(config: Config, endpoint: Endpoint, path: Path = CONFIG_PATH) -> None:
    config.endpoints[endpoint.name] = endpoint
    config.selected_endpoint = endpoint.name
    save_config(config, path)


def check_config_compatibility(path: Path = CONFIG_PATH) -> bool:
    """\
    returns `False` if config file exists but is not compatible with the current version

    TODO: add more sophisticated version checking
    """
    if not path.exists():
        return True
    config = _load_config_if_compatible(path)
    return config is not None


def endpoint_table(config: Config) -> Table:
    table = Table(title="Available Endpoints")
    table.add_column("Name", style="cyan")
    table.add_column("API", style="cyan")
    table.add_column("S3", style="cyan")

    for name, endpoint in config.endpoints.items():
        display_name = (
            Text(f"* {name}", style="bold yellow")
            if name == config.selected_endpoint
            else Text(f"  {name}")
        )
        table.add_row(display_name, endpoint.api, endpoint.s3)
    return table


@dataclass
class SharedState:
    log_file: Optional[Path] = None
    verbose: bool = True
    debug: bool = False
    max_table_size: int = MAX_TABLE_SIZE


SHARED_STATE = SharedState()


def get_shared_state() -> SharedState:
    return SHARED_STATE
