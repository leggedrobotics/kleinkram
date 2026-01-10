from __future__ import annotations

import logging
import os
import sys
import time
from enum import Enum
from pathlib import Path
from typing import List
from typing import Optional

import typer
from click import Context
from rich.console import Console
from typer.core import TyperGroup

from kleinkram._version import __version__
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import _claim_admin
from kleinkram.api.routes import _get_api_version
from kleinkram.auth import login_flow
from kleinkram.cli._action import action_typer
from kleinkram.cli._download import download_typer
from kleinkram.cli._endpoint import endpoint_typer
from kleinkram.cli._file import file_typer
from kleinkram.cli._list import list_typer
from kleinkram.cli._mission import mission_typer
from kleinkram.cli._project import project_typer
from kleinkram.cli._run import run_typer
from kleinkram.cli._upload import upload_typer
from kleinkram.cli._verify import verify_typer
from kleinkram.cli.error_handling import ErrorHandledTyper
from kleinkram.cli.error_handling import display_error
from kleinkram.config import MAX_TABLE_SIZE
from kleinkram.config import Config
from kleinkram.config import check_config_compatibility
from kleinkram.config import get_config
from kleinkram.config import get_shared_state
from kleinkram.config import save_config
from kleinkram.errors import InvalidCLIVersion
from kleinkram.utils import format_traceback
from kleinkram.utils import get_supported_api_version

# slightly cursed lambdas so that linters don't complain about unreachable code
if (lambda: os.name)() == "posix":
    LOG_DIR = Path().home() / ".local" / "state" / "kleinkram"
elif (lambda: os.name)() == "nt":
    LOG_DIR = Path().home() / "AppData" / "Local" / "kleinkram"
else:
    raise OSError(f"Unsupported OS {os.name}")

LOG_FILE = LOG_DIR / f"{time.time_ns()}.log"
LOG_FORMAT = "%(asctime)s | %(name)s | %(levelname)s | %(message)s"

# setup default logging
logger = logging.getLogger(__name__)


CLI_HELP = """\
Kleinkram CLI

The Kleinkram CLI is a command line interface for Kleinkram.
For a list of available commands, run `klein --help` or visit \
https://docs.datasets.leggedrobotics.com/usage/python/setup \
for more information.
"""


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


LOG_LEVEL_MAP = {
    LogLevel.DEBUG: logging.DEBUG,
    LogLevel.INFO: logging.INFO,
    LogLevel.WARNING: logging.WARNING,
    LogLevel.ERROR: logging.ERROR,
    LogLevel.CRITICAL: logging.CRITICAL,
}


class CommandTypes(str, Enum):
    AUTH = "Authentication Commands"
    CORE = "Core Commands"
    CRUD = "Create Update Delete Commands"
    ACTION = "Kleinkram Action Commands"


class OrderCommands(TyperGroup):
    def list_commands(self, ctx: Context) -> List[str]:
        _ = ctx  # suppress unused variable warning
        return list(self.commands)


app = ErrorHandledTyper(
    cls=OrderCommands,
    help=CLI_HELP,
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
)

app.add_typer(endpoint_typer, name="endpoint", rich_help_panel=CommandTypes.AUTH)

app.add_typer(download_typer, name="download", rich_help_panel=CommandTypes.CORE)
app.add_typer(upload_typer, name="upload", rich_help_panel=CommandTypes.CORE)
app.add_typer(verify_typer, name="verify", rich_help_panel=CommandTypes.CORE)
app.add_typer(list_typer, name="list", rich_help_panel=CommandTypes.CORE)

app.add_typer(file_typer, name="file", rich_help_panel=CommandTypes.CRUD)
app.add_typer(mission_typer, name="mission", rich_help_panel=CommandTypes.CRUD)
app.add_typer(project_typer, name="project", rich_help_panel=CommandTypes.CRUD)
app.add_typer(action_typer, name="action", rich_help_panel=CommandTypes.ACTION)
app.add_typer(run_typer, name="run", rich_help_panel=CommandTypes.ACTION)


# attach error handler to app
@app.error_handler(Exception)
def base_handler(exc: Exception) -> int:
    shared_state = get_shared_state()

    display_error(exc=exc, verbose=shared_state.verbose)
    logger.error(format_traceback(exc))

    if not shared_state.debug:
        return 1
    raise exc


@app.command(rich_help_panel=CommandTypes.AUTH)
def login(
    oAuthProvider: str = typer.Option(
        "auto",
        "--oauth-provider",
        "-p",
        help="OAuth provider to use for login. Supported providers: google, github, fake-oauth.",
        show_default=True,
    ),
    key: Optional[str] = typer.Option(None, help="CLI key"),
    headless: bool = typer.Option(False),
    user: Optional[str] = typer.Option(
        None,
        "--user",
        "-u",
        help="Auto-select user ID for fake-oauth (e.g., 1, 2, 3). Only works with fake-oauth provider.",
    ),
) -> None:

    # logic to resolve the "auto" default
    if oAuthProvider == "auto":
        config = get_config()
        if config.selected_endpoint == "local":
            oAuthProvider = "fake-oauth"
        else:
            oAuthProvider = "google"

    # validate oAuthProvider
    if oAuthProvider not in ["google", "github", "fake-oauth"]:
        raise typer.BadParameter(
            f"Unsupported OAuth provider '{oAuthProvider}'. Supported providers: google, github, fake-oauth."
        )

    # validate that user parameter is only used with fake-oauth
    if user is not None and oAuthProvider != "fake-oauth":
        raise typer.BadParameter("--user parameter can only be used with fake-oauth provider")

    login_flow(oAuthProvider=oAuthProvider, key=key, headless=headless, user=user)


@app.command(rich_help_panel=CommandTypes.AUTH)
def logout(all: bool = typer.Option(False, help="logout on all enpoints")) -> None:
    config = get_config()
    if all:
        config.endpoint_credentials.clear()
    else:
        config.endpoint_credentials.pop(config.selected_endpoint, None)
    save_config(config)


@app.command(hidden=True)
def claim():
    client = AuthenticatedClient()
    _claim_admin(client)
    print("admin rights claimed successfully.")


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(__version__)
        raise typer.Exit()


def check_version_compatibility() -> None:
    cli_version = get_supported_api_version()
    api_version = _get_api_version()
    api_vers_str = ".".join(map(str, api_version))

    if cli_version[0] != api_version[0]:
        raise InvalidCLIVersion(
            f"You are using an unsupported CLI version ({__version__}). "
            f"Please upgrade the CLI to version {api_vers_str} to continue using the CLI."
        )

    if cli_version[1] != api_version[1]:
        if cli_version < api_version:
            msg = f"You are using an outdated CLI version ({__version__}). "
            msg += f"Please consider upgrading the CLI to version {api_vers_str}."
            Console(file=sys.stderr).print(msg, style="red")
            logger.warning(msg)
        elif cli_version > api_version:
            msg = f"You are using a CLI version ({__version__}) that is newer than the server version ({api_vers_str}). "
            msg += "Please ask the admin to update the server."
            Console(file=sys.stderr).print(msg, style="yellow")
            logger.warning(msg)


@app.callback()
def cli(
    verbose: bool = typer.Option(True, help="Enable verbose mode."),
    debug: bool = typer.Option(False, help="Enable debug mode."),
    version: Optional[bool] = typer.Option(None, "--version", "-v", callback=_version_callback),
    log_level: Optional[LogLevel] = typer.Option(None, help="Set log level."),
    max_lines: int = typer.Option(
        MAX_TABLE_SIZE,
        "--max-lines",
        help="Maximum number of lines when pretty printing tables. -1 for unlimited.",
    ),
):
    if not check_config_compatibility():
        typer.confirm("found incompatible config file, overwrite?", abort=True)
        save_config(Config())

    _ = version  # suppress unused variable warning
    shared_state = get_shared_state()
    shared_state.verbose = verbose
    shared_state.debug = debug

    if max_lines < 0 and max_lines != -1:
        raise typer.BadParameter("`--max-lines` must be -1 or positive")
    shared_state.max_table_size = max_lines

    if shared_state.debug and log_level is None:
        log_level = LogLevel.DEBUG
    if log_level is None:
        log_level = LogLevel.WARNING

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(level=LOG_LEVEL_MAP[log_level], filename=LOG_FILE, format=LOG_FORMAT)
    logger.info(f"CLI version: {__version__}")

    try:
        check_version_compatibility()
    except InvalidCLIVersion as e:
        logger.error(format_traceback(e))
        raise
    except Exception:
        err = "failed to check version compatibility"
        Console(file=sys.stderr).print(err, style="yellow" if shared_state.verbose else None)
        logger.error(err)
