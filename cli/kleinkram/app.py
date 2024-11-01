from __future__ import annotations

import typer
from typing import Optional
from kleinkram.utils import get_version
from kleinkram.auth import login_flow
from kleinkram.config import Config
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import claim_admin


CLI_HELP = """\
Kleinkram CLI

The Kleinkram CLI is a command line interface for Kleinkram.
For a list of available commands, run `klein --help` or visit \
https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html \
for more information.
"""

app = typer.Typer(
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
    help=CLI_HELP,
)


@app.command()
def login(
    key: Optional[str] = typer.Option(None, help="CLI key"),
    headless: bool = typer.Option(False),
) -> None:
    login_flow(key=key, headless=headless)


@app.command()
def logout(all: bool = typer.Option(False, help="logout on all enpoints")) -> None:
    config = Config()
    config.clear_credentials(all=all)


@app.command(hidden=True)
def claim():
    client = AuthenticatedClient()
    claim_admin(client)
    print("Admin rights claimed successfully.")


@app.command()
def upload():
    raise NotImplementedError


@app.command()
def download():
    raise NotImplementedError


def _version_cb(value: bool) -> None:
    if value:
        typer.echo(get_version())
        raise typer.Exit()


@app.callback()
def cli(
    verbose: bool = typer.Option(True),
    version: Optional[bool] = typer.Option(None, "--version", callback=_version_cb),
):
    pass
