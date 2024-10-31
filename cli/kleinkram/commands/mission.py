from __future__ import annotations

from typing import List
from typing import Optional

import typer

missionCommands = typer.Typer(
    name="mission",
    help="Mission operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@missionCommands.command("tag")
def tag(
    mission_id: str = typer.Argument(),
    tagtype_id: str = typer.Argument(),
    value: str = typer.Argument(),
):
    raise NotImplementedError


@missionCommands.command("list")
def list_(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    verbose: Optional[bool] = typer.Option(
        False, help="Outputs a table with more information"
    ),
):
    raise NotImplementedError


@missionCommands.command("info")
def info(
    id: str = typer.Argument(),
    verbose: Optional[bool] = typer.Option(False, help="Outputs more information"),
):
    raise NotImplementedError


@missionCommands.command("download")
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


@missionCommands.command("upload")
def upload(
    path: List[str] = typer.Option(
        prompt=True, help="Path to files to upload, Regex supported"
    ),
    mission: str = typer.Option(prompt=True, help="UUID of Mission to create"),
):
    raise NotImplementedError
