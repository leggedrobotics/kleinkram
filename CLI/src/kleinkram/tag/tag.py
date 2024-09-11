from typing_extensions import Annotated

import httpx
import typer
from rich.console import Console
from rich.table import Table

from kleinkram.api_client import AuthenticatedClient

tag = typer.Typer(
    name="tag",
    help="Tag operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@tag.command("list-tag-types")
def tag_types(
    verbose: Annotated[bool, typer.Option()] = False,
):
    """
    List all tagtypes
    """

    try:
        client = AuthenticatedClient()
        response = client.get("/tag/all")
        response.raise_for_status()
        data = response.json()

        if not data or len(data) == 0:
            print("No tagtypes found")
            return

        if verbose:
            table = Table("UUID", "Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["uuid"], tagtype["name"], tagtype["datatype"])
        else:
            table = Table("Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["name"], tagtype["datatype"])
        console = Console()
        console.print(table)

    except:
        print("Failed to fetch tagtypes")
        raise Exception("Failed to fetch tagtypes")


@tag.command("delete")
def delete_tag(
    taguuid: Annotated[str, typer.Argument()],
):
    """
    Delete a tag
    """

    try:
        client = AuthenticatedClient()
        response = client.delete(f"/tag/{taguuid}")
        if response.status_code < 400:
            print("Deleted tag")
        else:
            print(response)
            print("Failed to delete tag")
            raise Exception("Failed to delete tag")
    except httpx.HTTPError as e:
        print("Failed to delete tag")
        raise Exception("Failed to delete tag")
