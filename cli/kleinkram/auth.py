from __future__ import annotations

import os
import platform
import socket
import sys
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler
from http.server import HTTPServer
from typing import Callable
from typing import Optional

import httpx
from rich.console import Console

from kleinkram._version import __version__
from kleinkram.config import CONFIG_PATH
from kleinkram.config import Config
from kleinkram.config import Credentials
from kleinkram.config import Endpoint
from kleinkram.config import add_endpoint
from kleinkram.config import find_endpoint_by_api
from kleinkram.config import get_config
from kleinkram.config import save_config
from kleinkram.discovery import CLI_VERSION_HEADER
from kleinkram.discovery import ServerInfo
from kleinkram.discovery import discover
from kleinkram.discovery import host_name
from kleinkram.discovery import is_version_supported
from kleinkram.errors import NoEndpointConfigured
from kleinkram.errors import UpdateCLIVersion

DEFAULT_CALLBACK_PORT = 8000
CLI_CALLBACK_ENDPOINT = "/cli/callback"
OAUTH_SLUG = "/auth/"
AUTH_TOKEN_FETCH_ERROR = "Failed to fetch authentication tokens."


def _has_browser() -> bool:
    """\
    whether a graphical browser can be opened on this machine

    `webbrowser` happily picks a text browser (lynx, w3m) over SSH, which would
    take over the terminal, so a Linux machine without a display counts as
    headless.
    """
    if sys.platform.startswith("linux") and not (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
        return False
    try:
        webbrowser.get()
        return True
    except webbrowser.Error:
        return False


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith(CLI_CALLBACK_ENDPOINT):
            self.send_response(404)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(b"Invalid path")
            return

        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)

        try:
            auth_token = params.get("authtoken")
            refresh_token = params.get("refreshtoken")
            if not auth_token or not refresh_token:
                raise ValueError("Missing callback tokens")

            creds = Credentials(auth_token=auth_token[0], refresh_token=refresh_token[0])
            config = get_config()
            config.credentials = creds
            save_config(config)
            self.server.auth_completed = True  # type: ignore[attr-defined]
        except Exception:
            self.send_response(500)
            self.send_header("Content-type", "text/plain")
            self.end_headers()
            self.wfile.write(AUTH_TOKEN_FETCH_ERROR.encode("utf-8"))
            self.server.auth_error = AUTH_TOKEN_FETCH_ERROR  # type: ignore[attr-defined]
            return

        self.send_response(200)
        self.send_header("Content-type", "text/html")
        self.end_headers()
        self.wfile.write(b"Authentication successful. You can close this window.")

    def log_message(self, *args, **kwargs):
        _ = args, kwargs
        pass  # suppress logging


def _browser_auth(*, url: str, server: HTTPServer) -> None:
    server.auth_completed = False  # type: ignore[attr-defined]
    server.auth_error = None  # type: ignore[attr-defined]
    webbrowser.open(url)

    try:
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            server.timeout = max(0.1, remaining)
            server.handle_request()
            auth_error = getattr(server, "auth_error", None)
            if auth_error:
                raise RuntimeError(auth_error)
            if getattr(server, "auth_completed", False):
                break
    finally:
        server.server_close()

    if not server.auth_completed:
        raise RuntimeError("Authentication timed out or failed. Please try again.")
    print(f"Authentication complete. Tokens saved to {CONFIG_PATH}.")


def _create_callback_server(preferred_port: int = DEFAULT_CALLBACK_PORT) -> tuple[HTTPServer, int]:
    try:
        server = HTTPServer(("", preferred_port), OAuthCallbackHandler)
        return server, preferred_port
    except OSError:
        server = HTTPServer(("", 0), OAuthCallbackHandler)  # bind to any available port
        return server, int(server.server_address[1])


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


DEVICE_PATH = "/cli/device"
DEVICE_TOKEN_PATH = "/cli/device/token"
SLOW_DOWN_STEP = 5


class LoginFailed(Exception): ...


def _console() -> Console:
    return Console(file=sys.stderr, highlight=False)


def add_server(url: str, *, config: Optional[Config] = None) -> ServerInfo:
    """\
    discover the server behind `url`, save it and make it the active host

    A server that is already saved under another name (e.g. `prod` from an older
    CLI) keeps that name and its login.
    """
    config = config or get_config()
    console = _console()
    console.print(f"[dim]→ Checking {url} …[/dim]")
    info = discover(url)

    if not is_version_supported(__version__, info.min_cli_version):
        console.print(f"[red]This server needs CLI version {info.min_cli_version} or newer, " f"you have {__version__}.[/red]")
        raise UpdateCLIVersion()

    name = find_endpoint_by_api(config, info.api_url) or host_name(info.frontend_url)
    add_endpoint(config, Endpoint(name, info.api_url, info.s3_url))

    console.print(f"  [green]✓[/green] Kleinkram [bold]{name}[/bold]  [dim]server {info.server_version}[/dim]")
    console.print(f"  [dim]  api  {info.api_url}[/dim]")
    console.print(f"  [dim]  s3   {info.s3_url}[/dim]")
    return info


def _resolve_server(url: Optional[str], config: Config) -> None:
    if url is not None:
        add_server(url, config=config)
        return
    if config.has_endpoint:
        return
    if sys.stdin.isatty():
        entered = input("Address of your Kleinkram server (as opened in the browser): ").strip()
        if entered:
            add_server(entered, config=config)
            return
    raise NoEndpointConfigured()


def _device_client(api: str) -> httpx.Client:
    return httpx.Client(base_url=api, timeout=30.0, headers={CLI_VERSION_HEADER: __version__})


def _device_auth(
    *,
    api: str,
    open_browser: bool,
    sleep: Callable[[float], None] = time.sleep,
) -> Credentials:
    """\
    log in by approving a short code in the web app (RFC 8628 style)

    Works the same on a laptop (the page opens by itself) and over SSH (the
    user opens the page on any other device).
    """
    console = _console()
    with _device_client(api) as client:
        response = client.post(
            DEVICE_PATH,
            json={
                "hostname": socket.gethostname()[:255],
                "platform": f"{platform.system()} {platform.machine()}".strip()[:255],
                "cliVersion": __version__,
            },
        )
        response.raise_for_status()
        authorization = response.json()

        user_code = authorization["userCode"]
        verification_uri = authorization["verificationUri"]
        complete_uri = authorization["verificationUriComplete"]
        interval = float(authorization.get("interval", 5))
        deadline = time.monotonic() + float(authorization.get("expiresIn", 600))

        opened = open_browser and webbrowser.open(complete_uri)
        if opened:
            console.print("\nOpening your browser to approve this login…")
            console.print(f"[dim]  If nothing opens, visit [/dim][blue]{complete_uri}[/blue]")
            console.print(f"[dim]  and check that it shows the code [/dim][bold]{user_code}[/bold]")
        else:
            console.print("\nOn any device, open:")
            console.print(f"  [blue]{verification_uri}[/blue]")
            console.print("and enter the code:\n")
            console.print(f"        [bold]{user_code}[/bold]\n")

        minutes = max(1, round((deadline - time.monotonic()) / 60))
        console.print(f"[dim]Waiting for approval (expires in {minutes} min, Ctrl+C to cancel)…[/dim]")

        while time.monotonic() < deadline:
            sleep(interval)
            poll = client.post(DEVICE_TOKEN_PATH, json={"deviceCode": authorization["deviceCode"]})
            poll.raise_for_status()
            result = poll.json()
            status = result.get("status")

            if status == "approved":
                return Credentials(auth_token=result["authToken"], refresh_token=result["refreshToken"])
            if status == "slow_down":
                interval += SLOW_DOWN_STEP
            elif status == "denied":
                raise LoginFailed("The login was denied in the browser.")
            elif status == "expired":
                break

    raise LoginFailed("The login code expired. Run `klein login` again.")


def _print_signed_in(config: Config) -> None:
    from kleinkram.api.client import AuthenticatedClient

    console = _console()
    try:
        client = AuthenticatedClient()
        me = client.get("/users/me")
        me.raise_for_status()
        user = me.json()
        who = f"[bold]{user.get('name', '')}[/bold] ({user.get('email', '')})"
    except Exception:
        who = "your account"
    console.print(f"[green]✓[/green] Signed in as {who} on [bold]{config.selected_endpoint}[/bold]")


def login_flow(
    *,
    url: Optional[str] = None,
    oAuthProvider: Optional[str] = None,
    key: Optional[str] = None,
    headless: bool = False,
    user: Optional[str] = None,
) -> None:
    config = get_config()
    _resolve_server(url, config)

    # use cli key login
    if key is not None:
        config.credentials = Credentials(api_key=key)
        save_config(config)
        _console().print(f"[green]✓[/green] Saved API key for [bold]{config.selected_endpoint}[/bold]")
        return

    # development: log in as a fake-oauth user without a browser
    if user is not None and oAuthProvider == "fake-oauth":
        _direct_oauth_auth(endpoint=config.endpoint.api, provider=oAuthProvider, user=user)
        _print_signed_in(config)
        return

    # explicitly chosen provider: the older flow through a local callback port
    if oAuthProvider is not None and not headless and _has_browser():
        server, callback_port = _create_callback_server()
        state = f"cli-port-{callback_port}"
        oauth_url = f"{config.endpoint.api}{OAUTH_SLUG}{oAuthProvider}?state={state}"
        if user is not None:
            oauth_url += f"&user={user}"
        _browser_auth(url=oauth_url, server=server)
        _print_signed_in(config)
        return

    credentials = _device_auth(api=config.endpoint.api, open_browser=not headless and _has_browser())
    config.credentials = credentials
    save_config(config)
    _print_signed_in(config)
