from __future__ import annotations

import urllib.parse
import webbrowser
from getpass import getpass
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from typing import Optional

from kleinkram.config import Config
from kleinkram.config import CONFIG_PATH
from kleinkram.config import CorruptedConfigFile
from kleinkram.config import Credentials
from kleinkram.config import InvalidConfigFile

CLI_CALLBACK_ENDPOINT = "/cli/callback"
OAUTH_SLUG = "/auth/google?state=cli"


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
        creds = Credentials(auth_token=auth_token, refresh_token=refresh_token)
        config.save_credentials(creds)
        print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")
    else:
        raise ValueError("Please provided tokens.")


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith(CLI_CALLBACK_ENDPOINT):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)

            try:
                creds = Credentials(
                    auth_token=params.get("authtoken")[0],  # type: ignore
                    refresh_token=params.get("refreshtoken")[0],  # type: ignore
                )
            except Exception:
                raise RuntimeError("Failed to fetch authentication tokens.")

            config = Config()
            config.save_credentials(creds)

            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Authentication successful. You can close this window.")
        else:
            raise RuntimeError("Invalid path")

    def log_message(self, *args, **kwargs):
        _ = args, kwargs
        pass  # suppress logging


def _browser_auth(*, url: str) -> None:
    webbrowser.open(url)

    server = HTTPServer(("", 8000), OAuthCallbackHandler)
    server.handle_request()

    print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")


def login_flow(*, key: Optional[str] = None, headless: bool = False) -> None:
    config = Config(overwrite=True)

    # use cli key login
    if key is not None:
        creds = Credentials(cli_key=key)
        config.save_credentials(creds)

    url = f"{config.endpoint}{OAUTH_SLUG}"

    if not headless and _has_browser():
        _browser_auth(url=url)
    else:
        headless_url = f"{url}-no-redirect"
        _headless_auth(url=headless_url)
