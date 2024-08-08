from typing import Annotated

import typer
from rich.table import Table

from kleinkram.auth.auth import client

tag = typer.Typer(name="tag", help="Tag operations")


@tag.command("list-tag-types")
def tagTypes(
    verbose: Annotated[bool, typer.Option()] = False,
):
    """List all tagtypes"""
    try:
        response = client.get("/tag/all")
        response.raise_for_status()
        data = response.json()
        if verbose:
            table = Table("UUID", "Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["uuid"], tagtype["name"], tagtype["datatype"])
        else:
            table = Table("Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["name"], tagtype["datatype"])
        print(table)
    except:
        print("Failed to fetch tagtypes")


@tag.command("delete")
def deleteTag(
    taguuid: Annotated[str, typer.Argument()],
):
    """Delete a tag"""
    try:
        response = client.delete("/tag/deleteTag", params={"uuid": taguuid})
        if response.status_code < 400:
            print("Deleted tag")
        else:
            print(response)
            print("Failed to delete tag")
    except:
        print("Failed to delete tag")
