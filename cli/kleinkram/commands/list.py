from __future__ import annotations


import typer

from kleinkram.api.client import AuthenticatedClient
from typing import Optional, List
from kleinkram.api.routes import get_files
from kleinkram.models import files_to_table
from typer import BadParameter

from rich.console import Console
from kleinkram.config import get_shared_state

list_typer = typer.Typer(name="list", invoke_without_command=True)


@list_typer.callback()
def list_(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project name"),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="mission name"),
    topics: List[str] = typer.Option(None, "--topics", "-t", help="topics"),
    metadata: Optional[List[str]] = typer.Argument(None, help="tag=value pairs"),
) -> None:
    client = AuthenticatedClient()

    _topics = topics if topics else None

    _metadata = {}
    if metadata is None:
        metadata = []
    for tag in metadata:
        if "=" not in tag:
            raise BadParameter("tag must be formatted as `key=value`")
        k, v = tag.split("=")
        _metadata[k] = v

    files = get_files(
        client, project=project, mission=mission, tags=_metadata, topics=_topics
    )

    if get_shared_state().verbose:
        table = files_to_table(files)
        console = Console()
        console.print(table)
    else:
        for file in files:
            print(file.id)
