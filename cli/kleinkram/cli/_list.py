from __future__ import annotations

from typing import List
from typing import Optional

import typer

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_files
from kleinkram.api.routes import get_missions
from kleinkram.api.routes import get_projects
from kleinkram.config import get_shared_state
from kleinkram.printing import print_files
from kleinkram.printing import print_missions
from kleinkram.printing import print_projects
from kleinkram.utils import split_args

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

    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)
    mission_query = MissionQuery(
        project_query=project_query,
        ids=mission_ids,
        patterns=mission_patterns,
    )
    file_query = FileQuery(
        mission_query=mission_query, patterns=file_patterns, ids=file_ids
    )

    client = AuthenticatedClient()
    parsed_files = list(get_files(client, file_query=file_query))
    print_files(parsed_files, pprint=get_shared_state().verbose)


@list_typer.command()
def missions(
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    missions: Optional[List[str]] = typer.Argument(None, help="mission names"),
) -> None:
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    client = AuthenticatedClient()
    parsed_missions = list(get_missions(client, mission_query=mission_query))
    print_missions(parsed_missions, pprint=get_shared_state().verbose)


@list_typer.command()
def projects(
    projects: Optional[List[str]] = typer.Argument(None, help="project names"),
) -> None:
    project_ids, project_patterns = split_args(projects or [])
    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)

    client = AuthenticatedClient()
    parsed_projects = list(get_projects(client, project_query=project_query))
    print_projects(parsed_projects, pprint=get_shared_state().verbose)
