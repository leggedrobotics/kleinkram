from __future__ import annotations

import json
import tempfile
import os

from typing import NamedTuple, Dict, Optional
from kleinkram.consts import LOCAL_API_URL
from pathlib import Path
from dataclasses import dataclass

CONFIG_PATH = Path().home() / ".kleinkram.json"
CORRUPTED_CONFIG_FILE_MESSAGE = (
    "Config file is corrupted.\nPlease run `klein login` to re-authenticate."
)


class Credentials(NamedTuple):
    auth_token: Optional[str] = None
    refresh_token: Optional[str] = None
    cli_key: Optional[str] = None


JSON_ENDPOINT_KEY = "endpoint"
JSON_CREDENTIALS_KEY = "credentials"


class CorruptedConfigFile(Exception):
    def __init__(self) -> None:
        super().__init__(CORRUPTED_CONFIG_FILE_MESSAGE)


class Config:
    endpoint: str
    credentials: Dict[str, Credentials]

    def __init__(self) -> None:
        self.credentials = {}
        self.endpoint = LOCAL_API_URL

        if not CONFIG_PATH.exists():
            self.save()
        try:
            with open(CONFIG_PATH, "r") as file:
                content = json.load(file)

                endpoint = content.get(JSON_ENDPOINT_KEY, None)
                if not isinstance(endpoint, str):
                    raise CorruptedConfigFile

                credentials = content.get(JSON_CREDENTIALS_KEY, None)
                if not isinstance(credentials, dict):
                    raise CorruptedConfigFile

                try:
                    parsed_creds = {}
                    for ep, creds in credentials.items():
                        parsed_creds[ep] = Credentials(**creds)
                except Exception:
                    raise CorruptedConfigFile

                self.endpoint = endpoint
                self.credentials = parsed_creds

        except Exception:
            raise CorruptedConfigFile

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
    verbose: bool = True


SHARED_STATE = _SharedState()


def get_shared_state() -> _SharedState:
    return SHARED_STATE
