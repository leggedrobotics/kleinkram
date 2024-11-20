from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import download_files
from kleinkram.config import get_shared_state
from kleinkram.models import files_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import get_files_by_spec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.utils import split_args
from rich.console import Console


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

    project_spec = ProjectSpec(
        project_filters=project_patterns, project_ids=project_ids
    )
    mission_spec = MissionSpec(
        project_spec=project_spec,
        mission_filters=mission_patterns,
        mission_ids=mission_ids,
    )
    file_spec = FileSpec(
        mission_spec=mission_spec, file_filters=file_patterns, file_ids=file_ids
    )

    client = AuthenticatedClient()
    parsed_files = get_files_by_spec(client, file_spec)

    if get_shared_state().verbose:
        table = files_to_table(parsed_files, title="downloading files...")
        Console().print(table)

    # get paths to files map
    if (
        len(set([(file.project_id, file.mission_id) for file in parsed_files])) > 1
        and not nested
    ):
        raise ValueError(
            "files from multiple missions were selected, consider using `--nested`"
        )
    elif not nested:
        # flat structure
        paths_to_files = {dest_dir / file.name: file for file in parsed_files}
    else:
        # allow for nested directories
        paths_to_files = {}
        for file in parsed_files:
            paths_to_files[
                dest_dir / file.project_name / file.mission_name / file.name
            ] = file

    # download files
    logger.info(f"downloading {paths_to_files} files to {dest_dir}")
    download_files(client, paths_to_files)
