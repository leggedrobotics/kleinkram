from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
import kleinkram.utils
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli._file_validator import FileValidator, _report_skipped_files
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionNotFound
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

HELP = """\
Upload files to kleinkram.
"""

upload_typer = typer.Typer(
    name="upload",
    no_args_is_help=True,
    invoke_without_command=True,
    help=HELP,
)


def _build_mission_query(mission: str, project: Optional[str]) -> MissionQuery:
    """Constructs the MissionQuery object from CLI args."""
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    return MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )


def _handle_no_files_to_upload(original_count: int, uploaded_count: int) -> None:
    """Checks if any files are left to upload and exits if not."""
    if uploaded_count > 0:
        return

    if original_count > 0:
        typer.echo(
            typer.style(
                "All paths were skipped. No files to upload.", fg=typer.colors.RED
            ),
            err=True,
        )
    else:
        typer.echo(
            typer.style("No files provided to upload.", fg=typer.colors.RED), err=True
        )
    raise typer.Exit(code=1)


@upload_typer.callback()
def upload(
    files: List[str] = typer.Argument(help="files to upload"),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project id or name"
    ),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    create: bool = typer.Option(False, help="create mission if it does not exist"),
    metadata: Optional[str] = typer.Option(
        None, help="path to metadata file (json or yaml)"
    ),
    fix_filenames: bool = typer.Option(
        False,
        help="fix filenames before upload, this does not change the filenames locally",
    ),
    skip: bool = typer.Option(
        False,
        "--skip",
        "-s",
        help="skip unsupported file types, badly named files, or directories instead of erroring",
    ),
    experimental_datatypes: bool = typer.Option(
        False, help="allow experimental datatypes (yaml, svo2, db3, tum)"
    ),
    ignore_missing_tags: bool = typer.Option(False, help="ignore mission tags"),
) -> None:
    original_file_paths = [Path(file) for file in files]
    mission_query = _build_mission_query(mission, project)

    validator = FileValidator(
        skip=skip,
        experimental_datatypes=experimental_datatypes,
    )

    # This function will raise an error if skip=False and a file is invalid
    files_to_upload = validator.filter_files(original_file_paths)

    _report_skipped_files(validator.skipped_files)

    _handle_no_files_to_upload(
        original_count=len(original_file_paths), uploaded_count=len(files_to_upload)
    )

    try:
        kleinkram.core.upload(
            client=AuthenticatedClient(),
            query=mission_query,
            file_paths=files_to_upload,
            create=create,
            metadata=load_metadata(Path(metadata)) if metadata else None,
            ignore_missing_metadata=ignore_missing_tags,
            verbose=get_shared_state().verbose,
        )
        typer.echo(
            typer.style(
                f"\nSuccessfully uploaded {len(files_to_upload)} file(s).",
                fg=typer.colors.GREEN,
            )
        )

    except MissionNotFound:
        if create:
            raise  # dont change the error message
        raise MissionNotFound("Mission not found. Use `--create` to create it.")
