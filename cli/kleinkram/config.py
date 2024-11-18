from __future__ import annotations

import json
import os
import tempfile
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Dict
from typing import NamedTuple
from typing import Optional

from kleinkram._version import __local__
from kleinkram._version import __version__
from kleinkram.errors import CorruptedConfigFile
from kleinkram.errors import InvalidConfigFile

CONFIG_PATH = Path().home() / ".kleinkram.json"


class Environment(Enum):
    LOCAL = "local"
    DEV = "dev"
    PROD = "prod"


DEFAULT_API = {
    Environment.LOCAL: "http://localhost:3000",
    Environment.DEV: "https://api.datasets.dev.leggedrobotics.com",
    Environment.PROD: "https://api.datasets.leggedrobotics.com",
}

LOCAL_S3 = "http://localhost:9000"


def get_env() -> Environment:
    if __local__:
        return Environment.LOCAL
    if "dev" in __version__:
        return Environment.DEV
    return Environment.PROD


def get_default_endpoints() -> str:
    env = get_env()
    return DEFAULT_API[env]


class Credentials(NamedTuple):
    auth_token: Optional[str] = None
    refresh_token: Optional[str] = None
    cli_key: Optional[str] = None


JSON_ENDPOINT_KEY = "endpoint"
JSON_CREDENTIALS_KEY = "credentials"


class Config:
    endpoint: str
    credentials: Dict[str, Credentials]

    def __init__(self, overwrite: bool = False) -> None:
        default_endpoint = get_default_endpoints()

        self.credentials = {}
        self.endpoint = default_endpoint

        if not CONFIG_PATH.exists():
            self.save()

        try:
            self._read_config()
        except (InvalidConfigFile, CorruptedConfigFile):
            if not overwrite:
                self.credentials = {}
                self.endpoint = default_endpoint
                self.save()
            else:
                raise

    def _read_config(self) -> None:
        with open(CONFIG_PATH, "r") as file:
            try:
                content = json.load(file)
            except Exception:
                raise CorruptedConfigFile

        endpoint = content.get(JSON_ENDPOINT_KEY, None)
        if not isinstance(endpoint, str):
            raise InvalidConfigFile

        credentials = content.get(JSON_CREDENTIALS_KEY, None)
        if not isinstance(credentials, dict):
            raise InvalidConfigFile

        try:
            parsed_creds = {}
            for ep, creds in credentials.items():
                parsed_creds[ep] = Credentials(**creds)
        except Exception:
            raise InvalidConfigFile

        self.endpoint = endpoint
        self.credentials = parsed_creds

    @property
    def has_cli_key(self) -> bool:
        if self.endpoint not in self.credentials:
            return False
        return self.credentials[self.endpoint].cli_key is not None

    @property
    def has_refresh_token(self) -> bool:
        if self.endpoint not in self.credentials:
            return False
        return self.credentials[self.endpoint].refresh_token is not None

    @property
    def auth_token(self) -> Optional[str]:
        return self.credentials[self.endpoint].auth_token

    @property
    def refresh_token(self) -> Optional[str]:
        return self.credentials[self.endpoint].refresh_token

    @property
    def cli_key(self) -> Optional[str]:
        return self.credentials[self.endpoint].cli_key

    def save(self) -> None:
        serialized_tokens = {}
        for endpoint, auth in self.credentials.items():
            serialized_tokens[endpoint] = auth._asdict()

        data = {
            JSON_ENDPOINT_KEY: self.endpoint,
            JSON_CREDENTIALS_KEY: serialized_tokens,
        }

        # atomically write to file
        fd, tmp_path = tempfile.mkstemp()
        with open(fd, "w") as file:
            json.dump(data, file)

        os.replace(tmp_path, CONFIG_PATH)

    def clear_credentials(self, all: bool = False) -> None:
        if all:
            self.credentials = {}
        elif self.endpoint in self.credentials:
            del self.credentials[self.endpoint]
        self.save()

    def save_credentials(self, creds: Credentials) -> None:
        self.credentials[self.endpoint] = creds
        self.save()


@dataclass
class _SharedState:
    log_file: Optional[Path] = None
    verbose: bool = True
    debug: bool = False


SHARED_STATE = _SharedState()


def get_shared_state() -> _SharedState:
    return SHARED_STATE
