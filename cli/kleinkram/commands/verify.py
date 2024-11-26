from __future__ import annotations

import logging
import sys
from enum import Enum
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text
from tqdm import tqdm

from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_shared_state
from kleinkram.errors import InvalidMissionSpec
from kleinkram.models import FileState
from kleinkram.resources import FileSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.resources import get_files
from kleinkram.resources import get_mission
from kleinkram.resources import mission_spec_is_unique
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)


class FileVerificationStatus(str, Enum):
    UPLAODED = "uploaded"
    UPLOADING = "uploading"
    COMPUTING_HASH = "computing hash"
    MISSING = "missing"
    MISMATCHED_HASH = "hash mismatch"
    UNKNOWN = "unknown"


FILE_STATUS_STYLES = {
    FileVerificationStatus.UPLAODED: "green",
    FileVerificationStatus.UPLOADING: "yellow",
    FileVerificationStatus.MISSING: "yellow",
    FileVerificationStatus.MISMATCHED_HASH: "red",
    FileVerificationStatus.UNKNOWN: "gray",
    FileVerificationStatus.COMPUTING_HASH: "purple",
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
    # get all filepaths
    if files is None:
        files = []

    file_paths = [Path(file) for file in files]
    check_file_paths(file_paths)
    files_map = get_filename_map(file_paths)

    # get the mission by the provided spec
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)
    mission_spec = MissionSpec(
        ids=mission_ids, patterns=mission_patterns, project_spec=project_spec
    )
    file_spec = FileSpec(mission_spec=mission_spec)

    client = AuthenticatedClient()

    # check first that the mission even exists, the mission could be empty
    if not mission_spec_is_unique(mission_spec):
        raise InvalidMissionSpec(f"mission spec is not unique: {mission_spec}")
    _ = get_mission(client, mission_spec)

    # get all files from that mission
    remote_files = {file.name: file for file in get_files(client, file_spec)}

    # verify files
    file_status: Dict[Path, FileVerificationStatus] = {}
    for name, file in tqdm(
        files_map.items(),
        desc="verifying files",
        unit="file",
        disable=not get_shared_state().verbose,
    ):
        if name not in remote_files:
            file_status[file] = FileVerificationStatus.MISSING
            continue

        remote_file = remote_files[name]

        if remote_file.state == FileState.UPLOADING:
            file_status[file] = FileVerificationStatus.UPLOADING
        elif remote_file.state == FileState.OK:
            if remote_file.hash is None:
                file_status[file] = FileVerificationStatus.COMPUTING_HASH
            elif skip_hash or remote_file.hash == b64_md5(file):
                file_status[file] = FileVerificationStatus.UPLAODED
            else:
                file_status[file] = FileVerificationStatus.MISMATCHED_HASH
        else:
            file_status[file] = FileVerificationStatus.UNKNOWN

    if get_shared_state().verbose:
        table = Table(title="file status")
        table.add_column("filename", style="cyan")
        table.add_column("status", style="green")

        for path, status in file_status.items():
            table.add_row(str(path), Text(status, style=FILE_STATUS_STYLES[status]))

        Console().print(table)
    else:
        for path, status in file_status.items():
            stream = (
                sys.stdout if status == FileVerificationStatus.UPLAODED else sys.stderr
            )
            print(path, file=stream)
