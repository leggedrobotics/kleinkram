"""\
`klein host`: the Kleinkram servers this CLI knows and which one is active

Servers are added with `klein login <url>`.
"""

from __future__ import annotations

import typer
from rich.console import Console

from kleinkram.config import endpoint_table
from kleinkram.config import get_config
from kleinkram.config import remove_endpoint
from kleinkram.config import select_endpoint

HELP = """\
Show and switch between Kleinkram servers.

Add a server with `klein login <url>`, using the address of its web app.
"""

host_typer = typer.Typer(
    name="host",
    help=HELP,
    context_settings={"help_option_names": ["-h", "--help"]},
    invoke_without_command=True,
    no_args_is_help=False,
)


def _print_hosts() -> None:
    config = get_config()
    console = Console()
    if not config.endpoints:
        console.print("No Kleinkram server configured yet. Add one with `klein login <url>`.")
        return
    console.print(endpoint_table(config))


@host_typer.callback()
def host(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand is None:
        _print_hosts()


@host_typer.command("list")
def list_hosts() -> None:
    """List the saved servers; `*` marks the active one."""
    _print_hosts()


@host_typer.command("use")
def use_host(name: str = typer.Argument(..., help="Name of the server, as shown by `klein host`")) -> None:
    """Make a saved server the active one."""
    config = get_config()
    try:
        select_endpoint(config, name)
    except ValueError:
        raise typer.BadParameter(f"no saved server named `{name}`, see `klein host`")
    Console().print(f"Now using [bold]{name}[/bold].")


@host_typer.command("remove")
def remove_host(name: str = typer.Argument(..., help="Name of the server, as shown by `klein host`")) -> None:
    """Forget a saved server and its login."""
    config = get_config()
    try:
        remove_endpoint(config, name)
    except ValueError:
        raise typer.BadParameter(f"no saved server named `{name}`, see `klein host`")
    Console().print(f"Removed [bold]{name}[/bold].")
