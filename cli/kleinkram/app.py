from __future__ import annotations

from typing import Optional, List

import typer

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import claim_admin
from kleinkram.auth import login_flow
from kleinkram.commands.download import download_typer
from kleinkram.commands.upload import upload_typer
from kleinkram.commands.verify import verify_typer
from kleinkram.commands.endpoint import endpoint_typer
from kleinkram.commands.list import list_typer
from kleinkram.commands.mission import mission_typer
from kleinkram.commands.project import project_typer
from kleinkram.config import Config
from kleinkram.config import get_shared_state
from kleinkram.utils import get_version
from typer.core import TyperGroup
from click import Context


CLI_HELP = """\
Kleinkram CLI

The Kleinkram CLI is a command line interface for Kleinkram.
For a list of available commands, run `klein --help` or visit \
https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html \
for more information.
"""


class OrderCommands(TyperGroup):
    def list_commands(self, ctx: Context) -> List[str]:
        _ = ctx  # suppress unused variable warning

        # TODO: sort commands
        return list(self.commands)


app = typer.Typer(
    cls=OrderCommands,
    help=CLI_HELP,
    context_settings={"help_option_names": ["-h", "--help"]},
)

app.add_typer(download_typer, name="download")
app.add_typer(upload_typer, name="upload")
app.add_typer(verify_typer, name="verify")
app.add_typer(list_typer, name="list")
app.add_typer(endpoint_typer, name="endpoint")
app.add_typer(mission_typer, name="mission")
app.add_typer(project_typer, name="project")


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
    print("admin rights claimed successfully.")


def _version_cb(value: bool) -> None:
    if value:
        typer.echo(get_version())
        raise typer.Exit()


@app.callback()
def cli(
    verbose: bool = typer.Option(True),
    version: Optional[bool] = typer.Option(None, "--version", callback=_version_cb),
    debug: bool = typer.Option(False),
):
    _ = version  # suppress unused variable warning
    shared_state = get_shared_state()
    shared_state.verbose = verbose
    shared_state.debug = debug
