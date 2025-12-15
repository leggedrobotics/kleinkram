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
        config.credentials = Credentials(auth_token=auth_token, refresh_token=refresh_token)
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


def _direct_oauth_auth(*, endpoint: str, provider: str, user: str) -> None:
    """
    Directly authenticate with fake OAuth by programmatically following the OAuth flow.
    This bypasses the browser entirely for automated testing.
    """
    import requests

    print(f"Authenticating as user {user} with {provider}...")

    try:
        # Step 1: Get the authorization code from fake OAuth
        # The fake OAuth server will auto-redirect when user parameter is provided
        fake_oauth_url = "http://localhost:8004/oauth/authorize"
        callback_url = f"{endpoint}/auth/{provider}/callback"

        params = {
            "client_id": "some-random-string-it-does-not-matter",
            "redirect_uri": callback_url,
            "response_type": "code",
            "state": "cli-direct",
            "user": user,
        }

        # Make request to fake OAuth - it will redirect with the auth code
        response = requests.get(fake_oauth_url, params=params, allow_redirects=False)

        if response.status_code not in [301, 302, 303, 307, 308]:
            raise RuntimeError(f"Expected redirect from OAuth provider, got {response.status_code}")

        # Extract the redirect location
        location = response.headers.get("Location")
        if not location:
            raise RuntimeError("No redirect location from OAuth provider")

        # Parse the callback URL to extract the auth code
        parsed = urllib.parse.urlparse(location)
        query_params = urllib.parse.parse_qs(parsed.query)

        if "code" not in query_params:
            raise RuntimeError(f"No authorization code in redirect: {location}")

        auth_code = query_params["code"][0]
        state = query_params.get("state", [None])[0]

        print("Received authorization code, exchanging for tokens...")

        # Step 2: Exchange the code for tokens by calling the backend callback
        # Use a session to preserve cookies
        session = requests.Session()
        callback_params = {"code": auth_code}
        if state:
            callback_params["state"] = state

        callback_response = session.get(callback_url, params=callback_params, allow_redirects=False)

        # The backend should set cookies and redirect
        if callback_response.status_code not in [301, 302, 303, 307, 308]:
            raise RuntimeError(f"Expected redirect from callback, got {callback_response.status_code}")

        # Extract tokens from cookies
        auth_token = session.cookies.get("authtoken")
        refresh_token = session.cookies.get("refreshtoken")

        if not auth_token or not refresh_token:
            raise RuntimeError("Failed to get tokens from callback response")

        # Save tokens
        config = get_config()
        config.credentials = Credentials(auth_token=auth_token, refresh_token=refresh_token)
        save_config(config)
        print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")

    except requests.RequestException as e:
        raise RuntimeError(f"OAuth flow failed: {e}")


def login_flow(
    *,
    oAuthProvider: str,
    key: Optional[str] = None,
    headless: bool = False,
    user: Optional[str] = None,
) -> None:
    config = get_config()
    # use cli key login
    if key is not None:
        config.credentials = Credentials(api_key=key)
        save_config(config)
        return

    # If user parameter is provided with fake-oauth, use direct OAuth flow
    if user is not None and oAuthProvider == "fake-oauth":
        _direct_oauth_auth(endpoint=config.endpoint.api, provider=oAuthProvider, user=user)
        return

    # Build OAuth URL with state parameter
    oauth_url = f"{config.endpoint.api}{OAUTH_SLUG}{oAuthProvider}?state=cli"

    # Add user parameter if provided (for fake-oauth auto-login)
    if user is not None:
        oauth_url += f"&user={user}"

    is_port_available = True
    try:
        server = HTTPServer(("", 8000), OAuthCallbackHandler)
        server.server_close()
    except OSError:
        is_port_available = False

    if not is_port_available:
        print("Warning: Port 8000 is not available. Falling back to headless authentication.\n\n")

    if not headless and _has_browser() and is_port_available:
        _browser_auth(url=oauth_url)
    else:
        _headless_auth(url=f"{oauth_url}-no-redirect")
