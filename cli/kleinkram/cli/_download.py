from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.config import get_shared_state
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)

HELP = """\
Download files from kleinkram.
"""


download_typer = typer.Typer(name="download", no_args_is_help=True, invoke_without_command=True, help=HELP)


@download_typer.callback()
def download(
    files: Optional[List[str]] = typer.Argument(None, help="file names, ids or patterns"),
    projects: Optional[List[str]] = typer.Option(None, "--project", "-p", help="project names, ids or patterns"),
    missions: Optional[List[str]] = typer.Option(None, "--mission", "-m", help="mission names, ids or patterns"),
    dest: str = typer.Option(prompt="destination", help="local path to save the files"),
    nested: bool = typer.Option(False, help="save files in nested directories, project-name/mission-name"),
    overwrite: bool = typer.Option(
        False,
        help="overwrite files if they already exist and don't match the file size or file hash",
    ),
    include_corrupt_files: bool = typer.Option(
        False,
        help="download files marked as CORRUPTED (potentially dangerous, use with caution)",
    ),
    yes: bool = typer.Option(
        False,
        "--yes",
        "-y",
        help="skip all confirmation prompts",
    ),
    allow_corrupt: bool = typer.Option(
        False,
        "--allow-corrupt",
        help="skip confirmation prompt for downloading files marked as CORRUPTED",
    ),
    create_dirs: bool = typer.Option(
        False,
        "--create-dirs",
        help="create missing destination directories without prompting",
    ),
) -> None:
    if include_corrupt_files:
        typer.secho(
            "Warning: --include-corrupt-files enables downloading files marked as CORRUPTED. "
            "These files may be harmful. Do not execute or open them blindly.",
            fg=typer.colors.YELLOW,
            err=True,
        )
        if not (yes or allow_corrupt):
            typer.confirm("Do you want to continue? You can use --yes or --allow-corrupt to skip this prompt.", abort=True)

    # create destination directory
    dest_dir = Path(dest)
    if not dest_dir.exists():
        if not (yes or create_dirs):
            typer.confirm(
                f"Destination {dest_dir} does not exist. Create it? You can use --yes or --create-dirs to skip this prompt.",
                abort=True,
            )
    dest_dir.mkdir(parents=True, exist_ok=True)

    # get file query
    file_ids, file_patterns = split_args(files or [])
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)
    mission_query = MissionQuery(
        patterns=mission_patterns,
        ids=mission_ids,
        project_query=project_query,
    )
    file_query = FileQuery(patterns=file_patterns, ids=file_ids, mission_query=mission_query)

    kleinkram.core.download(
        client=AuthenticatedClient(),
        query=file_query,
        allow_corrupt_files=include_corrupt_files,
        base_dir=dest_dir,
        nested=nested,
        overwrite=overwrite,
        verbose=get_shared_state().verbose,
    )
