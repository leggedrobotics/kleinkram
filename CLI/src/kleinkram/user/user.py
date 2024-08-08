from typing import Annotated

import typer
from rich.table import Table

from kleinkram.auth.auth import client

user = typer.Typer(name="users", help="User operations")


@user.command("list")
def users():
    """List all users"""
    response = client.get("/user/all")
    response.raise_for_status()
    data = response.json()
    table = Table("Name", "Email", "Role", "googleId")
    for user in data:
        table.add_row(user["name"], user["email"], user["role"], user["googleId"])
    print(table)


@user.command("info")
def user_info():
    """Get logged in user info"""
    response = client.get("/user/me")
    response.raise_for_status()
    data = response.json()
    print(data)


@user.command("promote")
def promote(email: Annotated[str, typer.Option()]):
    """Promote another user to admin"""
    response = client.post("/user/promote", json={"email": email})
    response.raise_for_status()
    print("User promoted.")


@user.command("demote")
def demote(email: Annotated[str, typer.Option()]):
    """Demote another user from admin"""
    response = client.post("/user/demote", json={"email": email})
    response.raise_for_status()
    print("User demoted.")
