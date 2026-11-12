"""\
find out everything the CLI needs about a Kleinkram server from one address

`klein login <url>` accepts the address of the web app (what people have in
their browser) or of the API. The web app publishes `/.well-known/kleinkram.json`
that names its API; the API answers `GET /cli/config` with the S3 address,
the login options and its version.
"""

from __future__ import annotations

import logging
import re
import urllib.parse
from dataclasses import dataclass
from typing import Any
from typing import List
from typing import Optional
from typing import Tuple

import httpx

from kleinkram._version import __version__
from kleinkram.errors import ServerDiscoveryError

logger = logging.getLogger(__name__)

WELL_KNOWN_PATH = "/.well-known/kleinkram.json"
CLI_CONFIG_PATH = "/cli/config"
CLI_VERSION_HEADER = "Kleinkram-Client-Version"
DISCOVERY_TIMEOUT = 10.0

_LOCAL_HOSTS = ("localhost", "127.0.0.1", "[::1]", "0.0.0.0")


@dataclass(frozen=True)
class ServerInfo:
    frontend_url: str
    api_url: str
    s3_url: str
    server_version: str
    min_cli_version: str
    auth_providers: List[str]
    device_flow: bool
    docs_url: Optional[str] = None


def _is_loopback(netloc: str) -> bool:
    host = urllib.parse.urlparse(f"//{netloc}").hostname or ""
    return host in ("localhost", "127.0.0.1", "::1", "0.0.0.0")


def require_secure(url: str, *, what: str) -> str:
    """\
    refuse plain http except for local development (localhost)

    Logins and tokens must never travel unencrypted, so neither an address the
    user typed nor one a server announces or redirects to may be http.
    """
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme == "https":
        return url
    if parsed.scheme == "http" and _is_loopback(parsed.netloc):
        return url
    raise ServerDiscoveryError(
        f"Refusing the insecure {what} {url}: Kleinkram servers must use https " "(plain http is only allowed for localhost)."
    )


def normalize_url(url: str) -> str:
    """\
    turn what a user typed into `scheme://host[:port]`

    A missing scheme means https, except for local addresses. Paths are
    dropped, so a copied link to any page of the web app works.
    """
    url = url.strip()
    if not url:
        raise ServerDiscoveryError("Please give the address of your Kleinkram server.")

    if "://" not in url:
        host = url.split("/")[0]
        scheme = "http" if host.split(":")[0] in _LOCAL_HOSTS or host.startswith("[::1]") else "https"
        url = f"{scheme}://{url}"

    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ServerDiscoveryError(f"`{url}` is not a valid http(s) address.")
    return require_secure(f"{parsed.scheme}://{parsed.netloc}", what="address")


def host_name(url: str) -> str:
    """name under which a server is saved in the config, e.g. `datasets.example.org`"""
    return urllib.parse.urlparse(normalize_url(url)).netloc


def _parse_version(version: str) -> Tuple[int, ...]:
    match = re.match(r"^\s*(\d+)\.(\d+)\.(\d+)", version)
    if match is None:
        return (0, 0, 0)
    return tuple(int(part) for part in match.groups())


def is_version_supported(cli_version: str, min_cli_version: str) -> bool:
    return _parse_version(cli_version) >= _parse_version(min_cli_version)


def _get_json(client: httpx.Client, url: str) -> Optional[Any]:
    try:
        response = client.get(url)
    except httpx.RequestError as e:
        logger.info(f"discovery request to {url} failed: {e!r}")
        return None
    # a redirect must not downgrade to http
    for hop in [*response.history, response]:
        require_secure(str(hop.url), what="redirect to")
    if response.status_code != 200:
        logger.info(f"discovery request to {url} returned {response.status_code}")
        return None
    try:
        return response.json()
    except ValueError:
        logger.info(f"discovery response of {url} is not JSON")
        return None


def _server_info_from_json(data: Any) -> Optional[ServerInfo]:
    if not isinstance(data, dict):
        return None
    try:
        return ServerInfo(
            frontend_url=str(data["frontendUrl"]).rstrip("/"),
            api_url=str(data["apiUrl"]).rstrip("/"),
            s3_url=str(data["s3Url"]).rstrip("/"),
            server_version=str(data.get("serverVersion", "")),
            min_cli_version=str(data.get("minCliVersion", "0.0.0")),
            auth_providers=[str(p) for p in data.get("authProviders", [])],
            device_flow=bool(data.get("deviceFlow", False)),
            docs_url=data.get("docsUrl"),
        )
    except KeyError:
        return None


def discover(url: str, client: Optional[httpx.Client] = None) -> ServerInfo:
    """\
    resolve the address of a web app or API to a `ServerInfo`

    raises `ServerDiscoveryError` if the address does not lead to a Kleinkram
    server that supports discovery
    """
    base = normalize_url(url)
    own_client = client is None
    if client is None:
        client = httpx.Client(
            timeout=DISCOVERY_TIMEOUT,
            follow_redirects=True,
            headers={CLI_VERSION_HEADER: __version__},
        )

    try:
        candidates: List[str] = []

        # the web app names its API
        well_known = _get_json(client, f"{base}{WELL_KNOWN_PATH}")
        if isinstance(well_known, dict) and isinstance(well_known.get("apiUrl"), str):
            candidates.append(well_known["apiUrl"].rstrip("/"))

        # or the address already is the API
        candidates.append(base)

        for api in dict.fromkeys(candidates):
            require_secure(api, what="API address")
            info = _server_info_from_json(_get_json(client, f"{api}{CLI_CONFIG_PATH}"))
            if info is not None:
                require_secure(info.api_url, what="API address")
                require_secure(info.s3_url, what="storage address")
                return info
    finally:
        if own_client:
            client.close()

    raise ServerDiscoveryError(
        f"Could not find a Kleinkram server at {base}.\n"
        "Check the address (use the one you open in the browser) and your network or VPN.\n"
        "Servers older than version 0.67 cannot be discovered; add them with "
        "`klein endpoint <name> <api-url> <s3-url>` instead."
    )
