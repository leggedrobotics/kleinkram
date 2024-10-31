from __future__ import annotations

import sys
from typing_extensions import Annotated

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_users, get_user_info, promote_user, demote_user

from rich.console import Console
from rich.table import Table

user = typer.Typer(
    name="users",
    help="User operations",
    no_args_is_help=True,
)


@user.command("list")
def users(verbose: Annotated[bool, typer.Option()] = False) -> None:
    """List all users"""

    client = AuthenticatedClient()
    users = get_users(client)

    if not verbose:
        for user in users:
            print(user.id)
        return

    table = Table(title="Users")
    table.add_column("UUID")
    table.add_column("Name")
    table.add_column("Email")
    table.add_column("Role")

    for user in users:
        table.add_row(str(user.id), user.name, user.email, user.role)

    console = Console()
    console.print(table)


@user.command("info")
def user_info() -> None:
    client = AuthenticatedClient()
    info = get_user_info(client)

    console = Console()
    console.print(info)


@user.command("promote")
def promote(email: Annotated[str, typer.Option()]):
    client = AuthenticatedClient()
    promote_user(client, email)
    print(f"User: {email} promoted.")


@user.command("demote")
def demote(email: Annotated[str, typer.Option()]):
    client = AuthenticatedClient()
    demote_user(client, email)
    print(f"User: {email} demoted.")
