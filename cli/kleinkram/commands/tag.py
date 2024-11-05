from __future__ import annotations

from uuid import UUID

import typer
from rich.console import Console
from typing_extensions import Annotated

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import delete_tag as _delete_tag
from kleinkram.api.routes import get_tag_types
from kleinkram.models import tag_types_table
from kleinkram.utils import is_valid_uuid4

tag_typer = typer.Typer(
    name="tag",
    help="Tag operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@tag_typer.command("list-types")
def list_tag_types(verbose: Annotated[bool, typer.Option()] = False) -> None:
    """\
    list all tag types
    """

    client = AuthenticatedClient()
    tags = get_tag_types(client)

    table = tag_types_table(tags, verbose=verbose)
    console = Console()
    console.print(table)


@tag_typer.command("delete")
def delete_tag(id: Annotated[str, typer.Argument()]) -> None:
    if not is_valid_uuid4(id):
        raise ValueError(f"Invalid UUID: {id}")

    client = AuthenticatedClient()
    _delete_tag(client, UUID(id))
