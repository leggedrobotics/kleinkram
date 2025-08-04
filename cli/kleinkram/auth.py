from __future__ import annotations

import urllib.parse
import webbrowser
from getpass import getpass
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from typing import Optional

from kleinkram.config import CONFIG_PATH
from kleinkram.config import Credentials
from kleinkram.config import get_config
from kleinkram.config import save_config

CLI_CALLBACK_ENDPOINT = "/cli/callback"
OAUTH_SLUG = "/auth/"


def _has_browser() -> bool:
    try:
        webbrowser.get()
        return True
    except webbrowser.Error:
        return False


def _headless_auth(*, url: str) -> None:

    print(f"please open the following URL manually to authenticate: {url}")
    print("enter the authentication token provided after logging in:")
    auth_token = getpass("authentication token: ")
    refresh_token = getpass("refresh token: ")

    if auth_token and refresh_token:
        config = get_config()
        config.credentials = Credentials(
            auth_token=auth_token, refresh_token=refresh_token
        )
        save_config(config)
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
                config = get_config()
                config.credentials = creds
                save_config(config)
            except Exception:
                raise RuntimeError("Failed to fetch authentication tokens.")

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


def login_flow(
    *, oAuthProvider: str, key: Optional[str] = None, headless: bool = False
) -> None:
    config = get_config()
    # use cli key login
    if key is not None:
        config.credentials = Credentials(api_key=key)
        save_config(config)
        return

    oauth_url = f"{config.endpoint.api}{OAUTH_SLUG}{oAuthProvider}?state=cli"
    if not headless and _has_browser():
        _browser_auth(url=oauth_url)
    else:
        _headless_auth(url=f"{oauth_url}-no-redirect")
