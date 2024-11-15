from __future__ import annotations

import sys
from pathlib import Path
from typing import List
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import download_file
from kleinkram.api.routes import get_files_by_file_spec
from kleinkram.config import get_shared_state
from kleinkram.models import FILE_STATE_COLOR
from kleinkram.models import files_to_table
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import get_valid_file_spec
from kleinkram.utils import to_name_or_uuid
from rich.console import Console


HELP = """\
Download files from kleinkram.
"""


download_typer = typer.Typer(
    name="download", no_args_is_help=True, invoke_without_command=True, help=HELP
)


@download_typer.callback()
def download(
    files: Optional[List[str]] = typer.Argument(
        None, help="file names, ids or patterns"
    ),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    mission: Optional[str] = typer.Option(
        None, "--mission", "-m", help="mission name or id"
    ),
    dest: str = typer.Option(prompt="destination", help="local path to save the files"),
) -> None:
    _files = [to_name_or_uuid(f) for f in files or []]
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission) if mission else None

    # create destionation directory
    dest_dir = Path(dest)

    if not dest_dir.exists():
        typer.confirm(f"Destination {dest_dir} does not exist. Create it?", abort=True)

    dest_dir.mkdir(parents=True, exist_ok=True)

    client = AuthenticatedClient()
    file_spec = get_valid_file_spec(_files, mission=_mission, project=_project)
    parsed_files = get_files_by_file_spec(client, file_spec)

    # check if filenames are unique
    if len(set(f.name for f in parsed_files)) != len(parsed_files):
        raise ValueError(
            "the files you are trying to download do not have unique names"
        )

    console = Console()
    if get_shared_state().verbose:
        table = files_to_table(parsed_files, title="downloading files...")
        console.print(table)

    for file in parsed_files:
        if file.state != FileState.OK:
            if get_shared_state().verbose:
                console.print(
                    f"Skipping file {file.name} with state ",
                    end="",
                )
                console.print(f"{file.state.value}", style=FILE_STATE_COLOR[file.state])
            else:
                print(
                    f"skipping file {file.name} with state {file.state.value}",
                    file=sys.stderr,
                )
            continue

        try:
            download_file(
                client,
                file_id=file.id,
                name=file.name,
                dest=dest_dir,
                hash=file.hash,
                size=file.size,
            )
        except FileExistsError:
            local_hash = b64_md5(dest_dir / file.name)
            if local_hash == file.hash:
                print(f"{file.name} already exists in dest, skipping...")
            else:
                print(f"{file.name} already exists in dest, but has different hash!")
        except Exception as e:
            print(f"Error downloading file {file.name}: {repr(e)}")
