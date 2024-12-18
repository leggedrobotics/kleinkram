from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import FileSpec
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.config import get_shared_state
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)

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
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project names, ids or patterns"
    ),
    missions: Optional[List[str]] = typer.Option(
        None, "--mission", "-m", help="mission names, ids or patterns"
    ),
    dest: str = typer.Option(prompt="destination", help="local path to save the files"),
    nested: bool = typer.Option(
        False, help="save files in nested directories, project-name/mission-name"
    ),
    overwrite: bool = typer.Option(
        False, help="overwrite files if they already exist and don't match the filehash"
    ),
) -> None:
    # create destionation directory
    dest_dir = Path(dest)
    if not dest_dir.exists():
        typer.confirm(f"Destination {dest_dir} does not exist. Create it?", abort=True)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # get file spec
    file_ids, file_patterns = split_args(files or [])
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_spec = ProjectSpec(patterns=project_patterns, ids=project_ids)
    mission_spec = MissionSpec(
        patterns=mission_patterns,
        ids=mission_ids,
        project_spec=project_spec,
    )
    file_spec = FileSpec(
        patterns=file_patterns, ids=file_ids, mission_spec=mission_spec
    )

    kleinkram.core.download(
        client=AuthenticatedClient(),
        spec=file_spec,
        base_dir=dest_dir,
        nested=nested,
        overwrite=overwrite,
        verbose=get_shared_state().verbose,
    )
