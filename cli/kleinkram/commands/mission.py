from __future__ import annotations

from typing import List
from typing import Optional

import typer

mission_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)


@mission_typer.command()
def tag(
    mission_id: str = typer.Argument(),
    tagtype_id: str = typer.Argument(),
    value: str = typer.Argument(),
):
    _ = mission_id, tagtype_id, value  # suppress warning
    raise NotImplementedError


@mission_typer.command("list")
def list_missions(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
):
    raise NotImplementedError


@mission_typer.command()
def info(
    id: str = typer.Argument(),
    verbose: Optional[bool] = typer.Option(False, help="Outputs more information"),
):
    raise NotImplementedError


@mission_typer.command()
def download(
    id: List[str] = typer.Option(help="UUIDs of Mission to download"),
    path: str = typer.Option(),
    pattern: Optional[str] = typer.Option(
        None,
        help="Simple pattern to match the filename against. Allowed are alphanumeric characters,"
        " '_', '-', '.' and '*' as wildcard.",
    ),
):
    raise NotImplementedError


@mission_typer.command()
def upload(
    path: List[str] = typer.Option(
        prompt=True, help="Path to files to upload, Regex supported"
    ),
    mission: str = typer.Option(prompt=True, help="UUID of Mission to create"),
):
    raise NotImplementedError
