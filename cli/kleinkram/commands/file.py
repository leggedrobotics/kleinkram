from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from uuid import UUID

import typer
from typing_extensions import Annotated

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_file
from kleinkram.api.routes import get_files
from kleinkram.file_transfer import download_file as _download_file

file_typer = typer.Typer(
    name="file",
    help="File operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@file_typer.command("download")
def download_file(
    id: Annotated[List[str], typer.Option(help="UUIDs of the files")],
    dest: Annotated[
        str,
        typer.Option(
            prompt=True,
            help="Local path to save the file",
        ),
    ],
) -> None:
    # create destionation directory
    dest_dir = Path(dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    client = AuthenticatedClient()
    for file_id in id:
        try:
            parsed_id = UUID(file_id, version=4)
        except ValueError:
            print(f"Invalid UUID: {file_id}")
            continue

        file = get_file(client, parsed_id)
        try:
            _download_file(
                client,
                file_id=file.id,
                name=file.name,
                dest=dest_dir,
                hash=file.hash,
                size=file.size,
            )
        except Exception as e:
            print(f"Error downloading file {file.name}: {e}")


@file_typer.command("list")
def list_files(
    project: Optional[str] = typer.Option(None, help="project name"),
    mission: Optional[str] = typer.Option(None, help="mission name"),
    topics: List[str] = typer.Option(None, help="topics"),
    tags: List[str] = typer.Option(None, help="tag=value pairs"),
) -> None:
    client = AuthenticatedClient()

    _tags = tags if tags else None
    _topics = topics if topics else None

    files = get_files(
        client, project=project, mission=mission, tags=_tags, topics=_topics
    )

    print_files(files)
