import sys

import typer
from rich.console import Console
from rich.table import Table
from typing_extensions import Annotated

from kleinkram.api_client import AuthenticatedClient

user = typer.Typer(
    name="users",
    help="User operations",
    no_args_is_help=True,
)


@user.command("list")
def users():
    """List all users"""

    client = AuthenticatedClient()
    response = client.get("/user/all")
    response.raise_for_status()
    data = response.json()

    console = Console(file=sys.stderr)
    console_stdout = Console(file=sys.stdout)

    ####
    # Print user UUIDs for command piping
    ####
    console.print("\nUser UUIDs: ")
    for _user in data:
        console.print(" - ", end="")
        console_stdout.print(_user["uuid"])
    console.print("\n")

    ####
    # Print table of the users
    ####
    table = Table("UUID", "Name", "Email", "Role", expand=True, highlight=False)
    for _user in data:
        table.add_row(_user["uuid"], _user["name"], _user["email"], _user["role"])
    console.print(table)


@user.command("info")
def user_info():
    """Get logged in user info"""
    client = AuthenticatedClient()
    response = client.get("/user/me")
    response.raise_for_status()
    data = response.json()

    # print prettified user info
    console = Console()
    console.print(data)


@user.command("promote")
def promote(email: Annotated[str, typer.Option()]):
    """Promote another user to admin"""
    client = AuthenticatedClient()
    response = client.post("/user/promote", json={"email": email})
    response.raise_for_status()
    print("User promoted.")


@user.command("demote")
def demote(email: Annotated[str, typer.Option()]):
    """Demote another user from admin"""
    client = AuthenticatedClient()
    response = client.post("/user/demote", json={"email": email})
    response.raise_for_status()
    print("User demoted.")
