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
from kleinkram.config import get_shared_state
from kleinkram.errors import FileNameNotSupported
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
    ignore_missing_tags: bool = typer.Option(False, help="ignore mission tags"),
) -> None:
    # get filepaths
    file_paths = [Path(file) for file in files]

    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    if not fix_filenames:
        for file in file_paths:
            if not kleinkram.utils.check_filename_is_sanatized(file.stem):
                raise FileNameNotSupported(
                    f"Only `{''.join(kleinkram.utils.INTERNAL_ALLOWED_CHARS)}` are "
                    f"allowed in filenames and at most 50 chars: {file}. "
                    f"Consider using `--fix-filenames`"
                )

    try:
        kleinkram.core.upload(
            client=AuthenticatedClient(),
            query=mission_query,
            file_paths=file_paths,
            create=create,
            metadata=load_metadata(Path(metadata)) if metadata else None,
            ignore_missing_metadata=ignore_missing_tags,
            verbose=get_shared_state().verbose,
        )
    except MissionNotFound:
        if create:
            raise  # dont change the error message
        raise MissionNotFound("Mission not found. Use `--create` to create it.")
