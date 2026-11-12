"""
this file contains a global config and a global state object

to get the config use `get_config()`
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path
from typing import Any
from typing import Callable
from typing import Dict
from typing import Iterator
from typing import NamedTuple
from typing import Optional

from rich.table import Table
from rich.text import Text

from kleinkram._version import __version__
from kleinkram.errors import NoEndpointConfigured
from kleinkram.utils import format_traceback

logger = logging.getLogger(__name__)

CONFIG_PATH = Path().home() / ".kleinkram.json"
MAX_TABLE_SIZE = 256


class Endpoint(NamedTuple):
    name: str
    api: str
    s3: str


class Credentials(NamedTuple):
    auth_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None


ACTION_API_KEY = "KLEINKRAM_API_KEY"
ACTION_API = "KLEINKRAM_API_ENDPOINT"
ACTION_S3 = "KLEINKRAM_S3_ENDPOINT"
ACTION_UUID = "KLEINKRAM_ACTION_UUID"


def get_running_action_uuid() -> Optional[str]:
    """
    The action this process is running inside, or None when it is not running
    inside a Kleinkram action container.
    """
    return os.getenv(ACTION_UUID)


def _get_endpoint_from_action_env_vars() -> Optional[Endpoint]:
    api = os.getenv(ACTION_API)
    s3 = os.getenv(ACTION_S3)
    if api is None or s3 is None:
        return None
    return Endpoint("action", api, s3)


def _get_api_key_from_action_env_vars() -> Optional[str]:
    return os.getenv(ACTION_API_KEY)


def _get_default_selected_endpoint() -> Optional[str]:
    """\
    there is no built-in server: a fresh config only knows the server of the
    action it runs in (if any), everything else is added with `klein login <url>`
    """
    env_endpoint = _get_endpoint_from_action_env_vars()
    if env_endpoint is not None:
        return env_endpoint.name
    return None


def _get_default_endpoints() -> Dict[str, Endpoint]:
    env_endpoint = _get_endpoint_from_action_env_vars()
    if env_endpoint is not None:
        return {env_endpoint.name: env_endpoint}
    return {}


def _get_default_credentials() -> Dict[str, Credentials]:
    endpoint = _get_endpoint_from_action_env_vars()
    api_key = _get_api_key_from_action_env_vars()
    if endpoint is not None and api_key is not None:
        return {endpoint.name: Credentials(api_key=api_key)}
    return {}


@dataclass
class Config:
    version: str = __version__
    selected_endpoint: Optional[str] = field(default_factory=_get_default_selected_endpoint)
    endpoints: Dict[str, Endpoint] = field(default_factory=_get_default_endpoints)
    endpoint_credentials: Dict[str, Credentials] = field(default_factory=_get_default_credentials)

    @property
    def has_endpoint(self) -> bool:
        return self.selected_endpoint is not None and self.selected_endpoint in self.endpoints

    @property
    def endpoint(self) -> Endpoint:
        if self.selected_endpoint is None or self.selected_endpoint not in self.endpoints:
            raise NoEndpointConfigured()
        return self.endpoints[self.selected_endpoint]

    @endpoint.setter
    def endpoint(self, value: Endpoint) -> None:
        if self.selected_endpoint is None:
            raise NoEndpointConfigured()
        self.endpoints[self.selected_endpoint] = value

    @property
    def credentials(self) -> Optional[Credentials]:
        if self.selected_endpoint is None:
            return None
        return self.endpoint_credentials.get(self.selected_endpoint)

    @credentials.setter
    def credentials(self, value: Credentials) -> None:
        if self.selected_endpoint is None:
            raise NoEndpointConfigured()
        self.endpoint_credentials[self.selected_endpoint] = value


def _config_to_dict(config: Config) -> Dict[str, Any]:
    return {
        "version": config.version,
        "endpoints": {key: value._asdict() for key, value in config.endpoints.items()},
        "endpoint_credentials": {key: value._asdict() for key, value in config.endpoint_credentials.items()},
        "selected_endpoint": config.selected_endpoint,
    }


def _config_from_dict(dct: Dict[str, Any]) -> Config:
    return Config(
        dct["version"],
        dct.get("selected_endpoint"),
        {key: Endpoint(**value) for key, value in dct["endpoints"].items()},
        {key: Credentials(**value) for key, value in dct["endpoint_credentials"].items()},
    )


def _safe_config_write(config: Config, path: Path, tmp_dir: Optional[Path] = None) -> None:
    # the temporary file must be on the same file system as the config, else
    # `os.replace` fails (e.g. /tmp on tmpfs); mkstemp creates it with 0600
    fd, temp_path = tempfile.mkstemp(dir=tmp_dir or path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(_config_to_dict(config), f)
        os.replace(temp_path, path)
    except BaseException:
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise


def _unsafe_config_write(config: Config, path: Path) -> None:
    # the file holds tokens: readable only by the user
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as f:
        json.dump(_config_to_dict(config), f)
    os.chmod(path, 0o600)


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
            dct = json.load(f)

            migrated = False
            for key, value in dct.get("endpoints", {}).items():
                if "s3" in value and "minio.datasets." in value["s3"]:
                    value["s3"] = value["s3"].replace("minio.datasets.", "s3.datasets.")
                    migrated = True

            config = _config_from_dict(dct)
            if migrated:
                save_config(config, path)
            return config
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


@contextmanager
def config_file_lock(path: Path = CONFIG_PATH) -> Iterator[None]:
    """\
    serialize read-modify-write of the config file across `klein` processes

    Needed for refresh token rotation: two processes refreshing at the same time
    must not overwrite each other's newer token. Without `fcntl` (Windows) this
    is a no-op; the server's grace period covers the remaining race.
    """
    try:
        import fcntl
    except ImportError:  # pragma: no cover - Windows
        yield
        return

    lock_path = path.with_name(path.name + ".lock")
    fd = os.open(lock_path, os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def update_saved_credentials(
    name: str,
    update: Callable[[Optional[Credentials]], Optional[Credentials]],
    path: Path = CONFIG_PATH,
) -> Optional[Credentials]:
    """\
    change the saved credentials of one endpoint based on what is on disk now

    Re-reads the file under the lock, so changes another process made to other
    endpoints (or a newer token for this one) are kept. Returns the new value.
    """
    with config_file_lock(path):
        on_disk = _load_config(path=path)
        new = update(on_disk.endpoint_credentials.get(name))
        if new is None:
            on_disk.endpoint_credentials.pop(name, None)
        else:
            on_disk.endpoint_credentials[name] = new
        save_config(on_disk, path)
    loaded = LOADED_CONFIGS.get(path)
    if loaded is not None:
        if new is None:
            loaded.endpoint_credentials.pop(name, None)
        else:
            loaded.endpoint_credentials[name] = new
    return new


def select_endpoint(config: Config, name: str, path: Path = CONFIG_PATH) -> None:
    if name not in config.endpoints:
        raise ValueError(f"Endpoint {name} not found.")
    config.selected_endpoint = name
    save_config(config, path)


def add_endpoint(config: Config, endpoint: Endpoint, path: Path = CONFIG_PATH) -> None:
    config.endpoints[endpoint.name] = endpoint
    config.selected_endpoint = endpoint.name
    save_config(config, path)


def remove_endpoint(config: Config, name: str, path: Path = CONFIG_PATH) -> None:
    if name not in config.endpoints:
        raise ValueError(f"Host {name} not found.")
    del config.endpoints[name]
    config.endpoint_credentials.pop(name, None)
    if config.selected_endpoint == name:
        config.selected_endpoint = next(iter(config.endpoints), None)
    save_config(config, path)


def find_endpoint_by_api(config: Config, api: str) -> Optional[str]:
    """name of a saved endpoint with this API address, so a new login keeps its name"""
    wanted = api.rstrip("/")
    for name, endpoint in config.endpoints.items():
        if endpoint.api.rstrip("/") == wanted:
            return name
    return None


def check_config_compatibility(path: Path = CONFIG_PATH) -> bool:
    """\
    returns `False` if config file exists but is not compatible with the current version

    TODO: add more sophisticated version checking
    """
    if not path.exists():
        return True
    config = _load_config_if_compatible(path)
    return config is not None


def _credentials_label(credentials: Optional[Credentials]) -> str:
    if credentials is None:
        return "not logged in"
    if credentials.api_key is not None:
        return "API key"
    return "logged in"


def endpoint_table(config: Config, title: str = "Kleinkram Hosts") -> Table:
    table = Table(title=title)
    table.add_column("Host", style="cyan")
    table.add_column("API", style="cyan")
    table.add_column("S3", style="cyan")
    table.add_column("Login")

    for name, endpoint in config.endpoints.items():
        display_name = Text(f"* {name}", style="bold yellow") if name == config.selected_endpoint else Text(f"  {name}")
        table.add_row(
            display_name,
            endpoint.api,
            endpoint.s3,
            _credentials_label(config.endpoint_credentials.get(name)),
        )
    return table


@dataclass
class SharedState:
    log_file: Optional[Path] = None
    verbose: bool = False
    debug: bool = False
    max_table_size: int = MAX_TABLE_SIZE


SHARED_STATE = SharedState()


def get_shared_state() -> SharedState:
    return SHARED_STATE
