from __future__ import annotations

import json
import logging
import os
import tempfile
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from typing import Dict
from typing import NamedTuple
from typing import Optional

from kleinkram._version import __local__
from kleinkram._version import __version__
from kleinkram.utils import format_traceback

logger = logging.getLogger(__name__)

CONFIG_PATH = Path().home() / ".kleinkram.json"


class Environment(Enum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


class Endpoint(NamedTuple):
    api: str
    s3: str


DEFAULT_LOCAL_API = "http://localhost:3000"
DEFAULT_LOCAL_S3 = "http://localhost:9000"

DEFAULT_DEV_API = "https://api.datasets.dev.leggedrobotics.com"
DEFAULT_DEV_S3 = "https://s3.datasets.dev.leggedrobotics.com"

DEFAULT_PROD_API = "https://api.datasets.leggedrobotics.com"
DEFAULT_PROD_S3 = "https://s3.datasets.leggedrobotics.com"


DEFAULT_ENDPOINTS = {
    "local": Endpoint(DEFAULT_LOCAL_API, DEFAULT_LOCAL_S3),
    "dev": Endpoint(DEFAULT_DEV_API, DEFAULT_DEV_S3),
    "prod": Endpoint(DEFAULT_PROD_API, DEFAULT_PROD_S3),
}


def get_env() -> Environment:
    if __local__:
        return Environment.LOCAL
    if "dev" in __version__:
        return Environment.DEV
    return Environment.PROD


class Credentials(NamedTuple):
    auth_token: Optional[str] = None
    refresh_token: Optional[str] = None
    cli_key: Optional[str] = None


JSON_ENDPOINT_KEY = "endpoint"
JSON_CREDENTIALS_KEY = "credentials"

CONFIG_INSTANCE: Optional[Config] = None


@dataclass(frozen=True)
class Config:
    version: str
    endpoints: Dict[str, Endpoint]
    endpoint_credentials: Dict[str, Credentials]
    selected_endpoint: str = field(default_factory=lambda: get_env().value)

    @property
    def endpoint(self) -> Endpoint:
        return self.endpoints[self.selected_endpoint]

    @property
    def credentials(self) -> Optional[Credentials]:
        return self.endpoint_credentials.get(self.selected_endpoint)


def get_default_config() -> Config:
    return Config(__version__, DEFAULT_ENDPOINTS, {})


def save_config(config: Config) -> None:
    fd, temp_path = tempfile.mkstemp()
    with os.fdopen(fd, "w") as f:
        json.dump(
            {
                "version": config.version,
                "endpoints": {
                    key: value._asdict() for key, value in config.endpoints.items()
                },
                "endpoint_credentials": {
                    key: value._asdict()
                    for key, value in config.endpoint_credentials.items()
                },
                "selected_endpoint": config.selected_endpoint,
            },
            f,
        )
    os.replace(temp_path, CONFIG_PATH)


def save_credentials(config: Config, credentials: Credentials) -> None:
    config.endpoint_credentials[config.selected_endpoint] = credentials
    save_config(config)


LOADED_CONFIG: Optional[Config] = None


def load_config(*, init: bool = False, cached: bool = True) -> Config:
    global LOADED_CONFIG
    if cached and LOADED_CONFIG:
        return LOADED_CONFIG
    try:
        with open(CONFIG_PATH, "r") as f:
            config = json.load(f)

        version = config["version"]
        endpoints = config["endpoints"]
        credentials = config["endpoint_credentials"]
        selected_endpoint = config["selected_endpoint"]

        config = Config(
            version,
            {key: Endpoint(**value) for key, value in endpoints.items()},
            {key: Credentials(**value) for key, value in credentials.items()},
            selected_endpoint,
        )
        LOADED_CONFIG = config
        return config

    except Exception as e:
        logger.error(format_traceback(e))

        config = get_default_config()
        LOADED_CONFIG = config
        if init:
            save_config(config)
        return config


@dataclass
class SharedState:
    log_file: Optional[Path] = None
    verbose: bool = True
    debug: bool = False


SHARED_STATE = SharedState()


def get_shared_state() -> SharedState:
    return SHARED_STATE
