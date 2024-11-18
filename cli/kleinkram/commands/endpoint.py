from __future__ import annotations

import sys

import typer
from kleinkram.auth import Config

HELP = """\
Get or set the current endpoint.

The endpoint is used to determine the API server to connect to\
(default is the API server of https://datasets.leggedrobotics.com).
"""

endpoint_typer = typer.Typer(
    name="endpoint",
    help=HELP,
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@endpoint_typer.command("set")
def set_endpoint(endpoint: str = typer.Argument(None, help="API endpoint to use")):
    """
    Use this command to switch between different API endpoints.\n
    Standard endpoints are:\n
    - http://localhost:3000\n
    - https://api.datasets.leggedrobotics.com\n
    - https://api.datasets.dev.leggedrobotics.com
    """

    if not endpoint:
        raise ValueError("No endpoint provided.")

    tokenfile = Config()
    tokenfile.endpoint = endpoint
    tokenfile.save()

    print(f"Endpoint set to: {endpoint}")
    if tokenfile.endpoint not in tokenfile.credentials:
        print("\nLogin with `klein login`.")


@endpoint_typer.command("list")
def list_endpoints():
    """
    Get the current endpoint

    Also displays all endpoints with saved tokens.
    """
    config = Config()
    print(f"Current endpoint: {config.endpoint}\n", file=sys.stderr)

    if not config.credentials:
        print("No saved credentials found.", file=sys.stderr)
        return

    print("Found Credentials for:", file=sys.stderr)
    for ep in config.credentials.keys():
        print(" - ", file=sys.stderr, end="", flush=True)
        print(ep, file=sys.stdout, flush=True)
