from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
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

    verbose = get_shared_state().verbose
    file_status = kleinkram.core.verify(
        client=AuthenticatedClient(),
        spec=mission_spec,
        file_paths=file_paths,
        skip_hash=skip_hash,
        verbose=verbose,
    )
    print_file_verification_status(file_status, pprint=verbose)
