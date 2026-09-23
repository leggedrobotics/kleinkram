from __future__ import annotations

from typing import List
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_file
from kleinkram.api.routes import get_files
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import prefer_new_list
from kleinkram.cli._deprecation import require
from kleinkram.cli._deprecation import warn_deprecated
from kleinkram.config import get_shared_state
from kleinkram.models import FileState
from kleinkram.printing import print_file_info
from kleinkram.printing import print_files
from kleinkram.utils import split_args

INFO_HELP = "get information about a file"
DELETE_HELP = "delete one or more files"


file_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


FILE_ARG_HELP = "file id or name"
DEPRECATED_FILE_FLAG = "--file/-f"


def _file_query(files: List[str], mission: Optional[str], project: Optional[str]) -> FileQuery:
    project_ids, project_patterns = split_args([project] if project else [])
    mission_ids, mission_patterns = split_args([mission] if mission else [])
    file_ids, file_patterns = split_args(files)

    return FileQuery(
        ids=file_ids,
        patterns=file_patterns,
        mission_query=MissionQuery(
            ids=mission_ids,
            patterns=mission_patterns,
            project_query=ProjectQuery(ids=project_ids, patterns=project_patterns),
        ),
    )


@file_typer.command(help=INFO_HELP, cls=CompatCommand)
def info(
    file: Optional[str] = typer.Argument(None, metavar="FILE", help=FILE_ARG_HELP),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="mission id or name"),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    file_flag: Optional[str] = typer.Option(None, "--file", "-f", hidden=True),
) -> None:
    file = require(prefer_new(file, file_flag, old=DEPRECATED_FILE_FLAG, new="the positional FILE argument"), "FILE")

    client = AuthenticatedClient()
    file_parsed = get_file(client, _file_query([file], mission, project))
    print_file_info(file_parsed, pprint=get_shared_state().verbose)


@file_typer.command(help=DELETE_HELP, cls=CompatCommand)
def delete(
    files: Optional[List[str]] = typer.Argument(None, metavar="FILES...", help="file ids or names"),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="mission id or name"),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
    file_flag: Optional[str] = typer.Option(None, "--file", "-f", hidden=True),
    confirm_flag: bool = typer.Option(False, "--confirm", hidden=True),
) -> None:
    files = prefer_new_list(files, file_flag, old=DEPRECATED_FILE_FLAG, new="the positional FILES... argument")
    if not files:
        raise typer.BadParameter("missing argument FILES...")
    if confirm_flag:
        warn_deprecated("--confirm", "--yes/-y")
        yes = True

    client = AuthenticatedClient()
    # resolve every file on its own so that each one has to match exactly one file
    files_parsed = [get_file(client, _file_query([file], mission, project)) for file in files]

    names = ", ".join(f"{f.project_name}/{f.mission_name}/{f.name}" for f in files_parsed)
    confirm_deletion(f"delete {len(files_parsed)} file(s): {names}", yes=yes)
    kleinkram.core.delete_files(client=client, file_ids=[f.id for f in files_parsed])


@file_typer.command(name="list", help="list files")
def list_files(
    files: Optional[List[str]] = typer.Argument(
        None,
        help="file names, ids or patterns",
    ),
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project name or id. Repeat flag for multiple values"
    ),
    missions: Optional[List[str]] = typer.Option(
        None, "--mission", "-m", help="mission name or id. Repeat flag for multiple values"
    ),
    include_canceled: bool = typer.Option(False, "--include-canceled", help="include canceled files"),
    include_states: Optional[List[FileState]] = typer.Option(
        None,
        "--include-states",
        help="file states to include. Repeat flag for multiple (e.g. --include-states OK --include-states FOUND)",
    ),
    exclude_states: Optional[List[FileState]] = typer.Option(
        None, "--exclude-states", help="file states to exclude. Repeat flag for multiple values"
    ),
) -> None:
    file_ids, file_patterns = split_args(files or [])
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)
    mission_query = MissionQuery(
        project_query=project_query,
        ids=mission_ids,
        patterns=mission_patterns,
    )
    file_query = FileQuery(
        mission_query=mission_query,
        patterns=file_patterns,
        ids=file_ids,
        include_states=[state.value for state in include_states] if include_states else [],
        exclude_states=(
            [state.value for state in exclude_states] if exclude_states else (["CANCELED"] if not include_canceled else [])
        ),
    )

    client = AuthenticatedClient()
    parsed_files = list(get_files(client, file_query=file_query))
    print_files(parsed_files, pprint=get_shared_state().verbose)
