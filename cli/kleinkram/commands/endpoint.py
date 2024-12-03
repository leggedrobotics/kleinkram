from __future__ import annotations

import sys
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text

from kleinkram.config import Config
from kleinkram.config import Endpoint
from kleinkram.config import load_config
from kleinkram.config import save_config

HELP = """\
Get or set the current endpoint.

The endpoint is used to determine the API server to connect to\
(default is the API server of https://datasets.leggedrobotics.com).
"""

endpoint_typer = typer.Typer(
    name="endpoint",
    help=HELP,
    context_settings={"help_option_names": ["-h", "--help"]},
    invoke_without_command=True,
)


def _endpoints_table(config: Config) -> Table:
    table = Table(title="Available Endpoints")
    table.add_column("Name", style="cyan")
    table.add_column("API", style="cyan")
    table.add_column("S3", style="cyan")

    for name, endpoint in config.endpoints.items():
        display_name = (
            Text(name, style="bold yellow")
            if name == config.selected_endpoint
            else Text(name)
        )
        table.add_row(display_name, endpoint.api, endpoint.s3)
    return table


@endpoint_typer.callback()
def endpoint(
    name: Optional[str] = typer.Argument(None, help="Name of the endpoint to use"),
    api: Optional[str] = typer.Argument(None, help="API endpoint to use"),
    s3: Optional[str] = typer.Argument(None, help="S3 endpoint to use"),
) -> None:
    config = load_config(init=True, cached=False)
    console = Console()

    if not any([name, api, s3]):
        console.print(_endpoints_table(config))
    elif name is not None and not any([api, s3]):
        if name not in config.endpoints:
            console.print(f"Endpoint {name} not found.\n", style="red")
            console.print(_endpoints_table(config))
        else:
            config = Config(
                version=config.version,
                endpoints=config.endpoints,
                endpoint_credentials=config.endpoint_credentials,
                selected_endpoint=name,
            )
            save_config(config)
    elif not (name and api and s3):
        raise typer.BadParameter("to add a new endpoint, all arguments are required")
    else:
        config.endpoints[name] = Endpoint(api, s3)
        config = Config(
            version=config.version,
            endpoints=config.endpoints,
            endpoint_credentials=config.endpoint_credentials,
            selected_endpoint=name,
        )
        save_config(config)
