from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.config import get_shared_state
from kleinkram.printing import print_file_verification_status
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)


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
    skip_hash: bool = typer.Option(None, help="skip hash check"),
    check_file_hash: bool = typer.Option(
        True,
        help="check file hash. If True, file names and file hashes are checked.",
    ),
    check_file_size: bool = typer.Option(
        True,
        help="check file size. If True, file names and file sizes are checked.",
    ),
) -> None:
    # get all filepaths
    file_paths = [Path(file) for file in files]

    # get mission query
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids, patterns=mission_patterns, project_query=project_query
    )

    verbose = get_shared_state().verbose
    file_status = kleinkram.core.verify(
        client=AuthenticatedClient(),
        query=mission_query,
        file_paths=file_paths,
        skip_hash=skip_hash,
        check_file_hash=check_file_hash,
        check_file_size=check_file_size,
        verbose=verbose,
    )
    print_file_verification_status(file_status, pprint=verbose)
