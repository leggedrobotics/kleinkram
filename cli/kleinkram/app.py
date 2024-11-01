from __future__ import annotations

import typer
from typing import Optional
from kleinkram.utils import get_version
from kleinkram.auth import login as _login
from kleinkram.auth import logout as _logout
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import claim_admin


CLI_HELP = '''\
Kleinkram CLI

The Kleinkram CLI is a command line interface for Kleinkram.
For a list of available commands, run 'klein --help' or visit \
https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html \
for more information.
'''

app = typer.Typer(
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
    help=CLI_HELP,
)


@app.callback()
def version() -> None:
    vers = get_version()
    typer.echo(f"kleinkram version {vers}")
    raise typer.Exit()


@app.callback()
def verbose():
    raise NotImplementedError


@app.command()
def login(
    key: Optional[str] = typer.Option(None, help="CLI key"),
    headless: bool = typer.Option(False),
) -> None:
    _login(key=key, headless=headless)


@app.command()
def logout(all: bool = typer.Option(False, help="logout on all enpoints")) -> None:
    _logout(all=all)


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
