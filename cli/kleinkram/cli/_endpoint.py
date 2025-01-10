"""
at the moment the endpoint command lets you specify the api and s3 endpoints
eventually it will be sufficient to just specify the api endpoint and the s3 endpoint will
be provided by the api
"""

from __future__ import annotations

from typing import Optional

import typer
from rich.console import Console

from kleinkram.config import Endpoint
from kleinkram.config import add_endpoint
from kleinkram.config import endpoint_table
from kleinkram.config import get_config
from kleinkram.config import select_endpoint

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


@endpoint_typer.callback()
def endpoint(
    name: Optional[str] = typer.Argument(None, help="Name of the endpoint to use"),
    api: Optional[str] = typer.Argument(None, help="API endpoint to use"),
    s3: Optional[str] = typer.Argument(None, help="S3 endpoint to use"),
) -> None:
    config = get_config()
    console = Console()

    if not any([name, api, s3]):
        console.print(endpoint_table(config))
    elif name is not None and not any([api, s3]):
        try:
            select_endpoint(config, name)
        except ValueError:
            console.print(f"Endpoint {name} not found.\n", style="red")
            console.print(endpoint_table(config))
    elif not (name and api and s3):
        raise typer.BadParameter(
            "to add a new endpoint you must specify the api and s3 endpoints"
        )
    else:
        new_endpoint = Endpoint(name, api, s3)
        add_endpoint(config, new_endpoint)
