from __future__ import annotations

import sys
from enum import Enum
from pathlib import Path
from typing import List
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_mission_by_spec
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionDoesNotExist
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import to_name_or_uuid
from rich.console import Console
from rich.table import Table
from rich.text import Text
from tqdm import tqdm


class FileVerificationStatus(str, Enum):
    UPLAODED = "uploaded"
    UPLOADING = "uploading"
    MISSING = "missing"
    CORRUPTED = "hash mismatch"
    UNKNOWN = "unknown"


FILE_STATUS_STYLES = {
    FileVerificationStatus.UPLAODED: "green",
    FileVerificationStatus.UPLOADING: "yellow",
    FileVerificationStatus.MISSING: "yellow",
    FileVerificationStatus.CORRUPTED: "red",
    FileVerificationStatus.UNKNOWN: "gray",
}


HELP = """\
Verify if files were uploaded correctly.
"""

verify_typer = typer.Typer(name="verify", invoke_without_command=True, help=HELP)


@verify_typer.callback()
def verify(
    files: List[str] = typer.Argument(help="files to upload"),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project id or name"
    ),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    skip_hash: bool = typer.Option(False, help="skip hash check"),
) -> None:
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission)

    client = AuthenticatedClient()

    if files is None:
        files = []

    mission_spec = get_valid_mission_spec(_mission, _project)
    mission_parsed = get_mission_by_spec(client, mission_spec)

    if mission_parsed is None:
        raise MissionDoesNotExist(f"Mission {mission} does not exist")

    # check file types
    file_paths = [Path(file) for file in files]
    check_file_paths(file_paths)

    filename_map = get_filename_map(file_paths)
    remote_files = {file.name: file for file in mission_parsed.files}

    status_dct = {}
    for name, file in tqdm(
        filename_map.items(),
        desc="verifying files",
        unit="file",
        disable=skip_hash or not get_shared_state().verbose,
    ):
        if name not in remote_files:
            status_dct[file] = FileVerificationStatus.MISSING
            continue

        state = remote_files[name].state

        if state == FileState.UPLOADING:
            status_dct[file] = FileVerificationStatus.UPLOADING
        elif state == FileState.OK and remote_files[name].hash != b64_md5(file):
            status_dct[file] = FileVerificationStatus.CORRUPTED
        elif state == FileState.OK:
            status_dct[file] = FileVerificationStatus.UPLAODED
        else:
            status_dct[file] = FileVerificationStatus.UNKNOWN

    if get_shared_state().verbose:
        table = Table(title="file status")
        table.add_column("filename", style="cyan")
        table.add_column("status", style="green")

        for path, status in status_dct.items():
            table.add_row(str(path), Text(status, style=FILE_STATUS_STYLES[status]))

        console = Console()
        console.print(table)
    else:
        for path, status in status_dct.items():
            stream = (
                sys.stdout if status == FileVerificationStatus.UPLAODED else sys.stderr
            )
            print(path, file=stream)
