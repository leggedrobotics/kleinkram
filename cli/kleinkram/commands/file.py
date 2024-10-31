from __future__ import annotations

from typing import List
from typing import Optional

import typer
from typing_extensions import Annotated

file = typer.Typer(
    name="file",
    help="File operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@file.command("download")
def download_file(
    file_uuid: Annotated[List[str], typer.Option(help="UUIDs of the files")],
    local_path: Annotated[
        str,
        typer.Option(
            prompt=True,
            help="Local path to save the file",
        ),
    ],
):
    raise NotImplementedError


@file.command("list")
def list_files(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    mission: Optional[str] = typer.Option(None, help="Name of Mission"),
    topics: Optional[str] = typer.Option(None, help="Comma separated list of topics"),
    tags: Optional[str] = typer.Option(
        None, help="Comma separated list of tagtype:tagvalue pairs"
    ),
):
    raise NotImplementedError
