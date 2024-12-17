from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional

import typer
from rich.console import Console
from rich.table import Table
from rich.text import Text

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.config import get_shared_state
from kleinkram.core import FileVerificationStatus
from kleinkram.utils import check_file_paths
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)


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


# TODO: where should this funciton live?
def _file_status_table(file_status: Dict[Path, FileVerificationStatus]) -> Table:
    table = Table(title="file status")
    table.add_column("filename", style="cyan")
    table.add_column("status", style="green")
    for path, status in file_status.items():
        table.add_row(str(path), Text(status, style=FILE_STATUS_STYLES[status]))
    return table


def _print_file_status(
    file_status: Dict[Path, FileVerificationStatus], verbose: bool
) -> None:
    if verbose:
        Console().print(_file_status_table(file_status))
    else:
        for path, status in file_status.items():
            stream = (
                sys.stdout if status == FileVerificationStatus.UPLAODED else sys.stderr
            )
            print(path, file=stream)


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
    file_paths = [Path(file) for file in files]

    # get mission spec
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])
    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)
    mission_spec = MissionSpec(
        ids=mission_ids, patterns=mission_patterns, project_spec=project_spec
    )

    file_status = kleinkram.core.verify(
        client=AuthenticatedClient(),
        spec=mission_spec,
        file_paths=file_paths,
        skip_hash=skip_hash,
        verbose=get_shared_state().verbose,
    )

    _print_file_status(file_status, get_shared_state().verbose)
