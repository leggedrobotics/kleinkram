from __future__ import annotations

import json
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from pathlib import Path
from typing import Optional
import os
import tempfile
from getpass import getpass

from kleinkram.consts import LOCAL_API_URL
from typing import TypedDict, cast, Dict

CONFIG_PATH = Path().home() / ".kleinkram.json"
CORRUPTED_CONFIG_FILE_MESSAGE = (
    "Config file is corrupted.\nPlease run `klein login` to re-authenticate."
)

REFRESH_TOKEN = "refreshtoken"
AUTH_TOKEN = "authtoken"
CLI_KEY = "clikey"

CLI_CALLBACK_ENDPOINT = "/cli/callback"
OAUTH_SLUG = "/auth/google?state=cli"


class TokensData(TypedDict):
    endpoint: str
    tokens: Dict[str, Dict[str, str]]


class Config:
    endpoint: str
    tokens: Dict[str, Dict[str, str]]

    def __init__(self) -> None:
        if not CONFIG_PATH.exists():
            self.tokens = {}
            self.endpoint = LOCAL_API_URL
            return
        try:
            with open(CONFIG_PATH, "r") as file:
                content = cast(TokensData, json.load(file))
                self.endpoint = content["endpoint"]
                self.tokens = content["tokens"]
        except Exception:
            print(CORRUPTED_CONFIG_FILE_MESSAGE)
            raise

    def has_cli_key(self) -> bool:
        return CLI_KEY in self.tokens[self.endpoint]

    @property
    def auth_token(self) -> str:
        return self.tokens[self.endpoint][AUTH_TOKEN]

    @property
    def refresh_token(self) -> str:
        return self.tokens[self.endpoint][REFRESH_TOKEN]

    @property
    def cli_key(self) -> str:
        return self.tokens[self.endpoint][CLI_KEY]

    def save(self) -> None:
        data = {
            "endpoint": self.endpoint,
            "tokens": self.tokens,
        }

        # atomically write to file
        fd, tmp_path = tempfile.mkstemp()
        with open(fd, "w") as file:
            json.dump(data, file)

        os.replace(tmp_path, CONFIG_PATH)

    def save_tokens(self, tokens: Dict[str, str]) -> None:
        self.tokens[self.endpoint] = tokens
        self.save()


def logout(*, all: bool = False):
    """
    Logout from the currently set endpoint.
    """

    if all:
        config = Config()
        config.tokens = {}
        config.save()
    else:
        config = Config()
        config.save_tokens({})
    print("Logged out.")


def _has_browser() -> bool:
    try:
        webbrowser.get()
        return True
    except webbrowser.Error:
        return False


def _headless_auth(*, url: str) -> None:
    config = Config()

    print(f"Please open the following URL manually to authenticate: {url}")
    print("Enter the authentication token provided after logging in:")
    auth_token = getpass("Authentication Token: ")
    refresh_token = getpass("Refresh Token: ")

    if auth_token and refresh_token:
        tokens = {
            AUTH_TOKEN: auth_token,
            REFRESH_TOKEN: refresh_token,
        }
        config.save_tokens(tokens)
        print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")
    else:
        raise ValueError("Please provided tokens.")


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(CLI_CALLBACK_ENDPOINT):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)

            try:
                tokens = {
                    AUTH_TOKEN: params.get(AUTH_TOKEN)[0],  # type: ignore
                    REFRESH_TOKEN: params.get(REFRESH_TOKEN)[0],  # type: ignore
                }
            except Exception:
                raise Exception("Failed to get authentication tokens.")

            config = Config()
            config.save_tokens(tokens)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Authentication successful. You can close this window.")
        else:
            raise RuntimeError("Invalid path")


def _browser_auth(*, url: str) -> None:
    webbrowser.open(url)

    server = HTTPServer(("", 8000), OAuthCallbackHandler)
    server.handle_request()

    print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")


def login(*, key: Optional[str] = None, headless: bool = False) -> None:
    config = Config()

    # use cli key login
    if key is not None:
        config.save_tokens({CLI_KEY: key})

    url = f"{config.endpoint}{OAUTH_SLUG}"

    if not headless and _has_browser():
        _browser_auth(url=url)
    else:
        headless_url = f"{url}-no-redirect"
        _headless_auth(url=headless_url)
