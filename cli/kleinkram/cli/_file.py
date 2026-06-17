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
from kleinkram.config import get_shared_state
from kleinkram.printing import print_file_info
from kleinkram.printing import print_files
from kleinkram.utils import split_args

INFO_HELP = "get information about a file"
DELETE_HELP = "delete a file"


file_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


@file_typer.command(help=INFO_HELP)
def info(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="mission id or name"),
    file: str = typer.Option(..., "--file", "-f", help="file id or name"),
) -> None:
    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    mission_ids, mission_patterns = split_args([mission] if mission else [])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    file_ids, file_patterns = split_args([file])
    file_query = FileQuery(
        ids=file_ids,
        patterns=file_patterns,
        mission_query=mission_query,
    )

    client = AuthenticatedClient()
    file_parsed = get_file(client, file_query)
    print_file_info(file_parsed, pprint=get_shared_state().verbose)


@file_typer.command(help=DELETE_HELP)
def delete(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="mission id or name"),
    file: str = typer.Option(..., "--file", "-f", help="file id or name"),
    confirm: bool = typer.Option(False, "--confirm", "-y", "--yes", help="confirm deletion"),
) -> None:
    if not confirm:
        typer.confirm(f"delete {project} {mission}", abort=True)

    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    mission_ids, mission_patterns = split_args([mission] if mission else [])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    file_ids, file_patterns = split_args([file])
    file_query = FileQuery(
        ids=file_ids,
        patterns=file_patterns,
        mission_query=mission_query,
    )

    client = AuthenticatedClient()
    file_parsed = get_file(client, file_query)
    kleinkram.core.delete_files(client=client, file_ids=[file_parsed.id])


@file_typer.command(name="list", help="list files")
def list_files(
    files: Optional[List[str]] = typer.Argument(
        None,
        help="file names, ids or patterns",
    ),
    projects: Optional[List[str]] = typer.Option(None, "--project", "-p", help="project name or id"),
    missions: Optional[List[str]] = typer.Option(None, "--mission", "-m", help="mission name or id"),
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
    file_query = FileQuery(mission_query=mission_query, patterns=file_patterns, ids=file_ids)

    client = AuthenticatedClient()
    parsed_files = list(get_files(client, file_query=file_query))
    print_files(parsed_files, pprint=get_shared_state().verbose)
