from __future__ import annotations

from typing import List
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_shared_state
from kleinkram.models import files_to_table
from kleinkram.models import missions_to_table
from kleinkram.models import projects_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import get_files_by_spec
from kleinkram.resources import get_missions_by_spec
from kleinkram.resources import get_projects_by_spec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.utils import split_args
from rich.console import Console


HELP = """\
List projects, missions, or files.
"""


list_typer = typer.Typer(
    name="list", invoke_without_command=True, help=HELP, no_args_is_help=True
)


@list_typer.command()
def files(
    files: Optional[List[str]] = typer.Argument(
        None,
        help="file names, ids or patterns",
    ),
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    missions: Optional[List[str]] = typer.Option(
        None, "--mission", "-m", help="mission name or id"
    ),
) -> None:
    file_ids, file_patterns = split_args(files or [])
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_spec = ProjectSpec(patterns=project_patterns, ids=project_ids)
    mission_spec = MissionSpec(
        project_spec=project_spec,
        ids=mission_ids,
        patterns=mission_patterns,
    )
    file_spec = FileSpec(
        mission_spec=mission_spec, patterns=file_patterns, ids=file_ids
    )

    client = AuthenticatedClient()
    parsed_files = get_files_by_spec(client, file_spec)

    if get_shared_state().verbose:
        Console().print(files_to_table(parsed_files))
    else:
        for file in parsed_files:
            print(file.id)


@list_typer.command()
def missions(
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    missions: Optional[List[str]] = typer.Argument(None, help="mission names"),
) -> None:
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)
    mission_spec = MissionSpec(
        ids=mission_ids,
        patterns=mission_patterns,
        project_spec=project_spec,
    )

    client = AuthenticatedClient()
    parsed_missions = get_missions_by_spec(client, mission_spec)

    if get_shared_state().verbose:
        Console().print(missions_to_table(parsed_missions))


@list_typer.command()
def projects(
    projects: Optional[List[str]] = typer.Argument(None, help="project names"),
) -> None:
    project_ids, project_patterns = split_args(projects or [])
    project_spec = ProjectSpec(patterns=project_patterns, ids=project_ids)

    client = AuthenticatedClient()
    parsed_projects = get_projects_by_spec(client, project_spec)

    if get_shared_state().verbose:
        Console().print(projects_to_table(parsed_projects))
    else:
        for project in parsed_projects:
            print(project.id)
