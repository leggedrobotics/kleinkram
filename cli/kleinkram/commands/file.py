from __future__ import annotations

from typing import List
from typing import Optional

import typer
from typing_extensions import Annotated
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_files, get_file, get_file_download
from kleinkram.file_transfer import download_file as _download_file
from kleinkram.models import print_files
from kleinkram.utils import b64_md5
from uuid import UUID
from pathlib import Path

file = typer.Typer(
    name="file",
    help="File operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@file.command("download")
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

        download_url = get_file_download(client, file.id)
        file_dest = dest_dir / file.name

        _download_file(download_url, file_dest, file.size)
        observed_hash = b64_md5(file_dest)

        if observed_hash != file.hash:
            print(f"Downloaded file {file.name} hash does not match the expected hash.")
        else:
            print(f"Downloaded file {file.name} successfully.")


@file.command("list")
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
