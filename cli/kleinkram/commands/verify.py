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
from kleinkram.utils import b64_md5
from kleinkram.utils import get_filename_map
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import to_name_or_uuid
from rich.console import Console
from rich.table import Table
from rich.text import Text
from tqdm import tqdm


class FileStatus(str, Enum):
    UPLAODED = 'uploaded'
    MISSING = 'missing'
    CORRUPTED = 'hash mismatch'


FILE_STATUS_STYLES = {
    FileStatus.UPLAODED: 'green',
    FileStatus.MISSING: 'yellow',
    FileStatus.CORRUPTED: 'red',
}


HELP = """\
Verify if files were uploaded correctly.
"""

verify_typer = typer.Typer(name='verify', invoke_without_command=True, help=HELP)


@verify_typer.callback()
def verify(
    files: List[str] = typer.Argument(help='files to upload'),
    project: Optional[str] = typer.Option(
        None, '--project', '-p', help='project id or name'
    ),
    mission: str = typer.Option(..., '--mission', '-m', help='mission id or name'),
    skip_hash: bool = typer.Option(False, help='skip hash check'),
) -> None:
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission) if mission else None

    client = AuthenticatedClient()

    if files is None:
        files = []

    mission_spec = get_valid_mission_spec(_mission, _project)
    mission_parsed = get_mission_by_spec(client, mission_spec)

    if mission_parsed is None:
        raise MissionDoesNotExist(f'Mission {mission} does not exist')

    local_files = [Path(file) for file in files]
    filename_map = get_filename_map(local_files)

    remote_files = {file.name: file.hash for file in mission_parsed.files}

    status_dct = {}
    for name, file in tqdm(
        filename_map.items(),
        desc='verifying files',
        unit='file',
        disable=skip_hash or not get_shared_state().verbose,
    ):
        if name not in remote_files:
            status_dct[file] = FileStatus.MISSING
        elif (
            name in remote_files
            and remote_files[name] is not None
            and remote_files[name] != b64_md5(file)
            and not skip_hash
        ):
            status_dct[file] = FileStatus.CORRUPTED
        else:
            status_dct[file] = FileStatus.UPLAODED

    if get_shared_state().verbose:
        table = Table(title='file status')
        table.add_column('filename', style='cyan')
        table.add_column('status', style='green')

        for path, status in status_dct.items():
            table.add_row(str(path), Text(status, style=FILE_STATUS_STYLES[status]))

        console = Console()
        console.print(table)
    else:
        for path, status in status_dct.items():
            stream = sys.stdout if status == FileStatus.UPLAODED else sys.stderr
            print(path, file=stream)
