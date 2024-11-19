from __future__ import annotations

from typing import List
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_files_by_file_spec
from kleinkram.api.routes import get_missions
from kleinkram.api.routes import get_projects
from kleinkram.config import get_shared_state
from kleinkram.models import files_to_table
from kleinkram.models import missions_to_table
from kleinkram.models import projects_to_table
from kleinkram.utils import get_valid_file_spec
from kleinkram.utils import to_name_or_uuid
from rich.console import Console
from typer import BadParameter


HELP = """\
List projects, missions, or files.
"""


list_typer = typer.Typer(
    name="list", invoke_without_command=True, help=HELP, no_args_is_help=True
)


def _parse_metadata(raw: List[str]) -> dict:
    ret = {}
    for tag in raw:
        if "=" not in tag:
            raise BadParameter("tag must be formatted as `key=value`")
        k, v = tag.split("=")
        ret[k] = v
    return ret


@list_typer.command()
def files(
    files: Optional[List[str]] = typer.Argument(
        None, help="file names, ids or patterns"
    ),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    mission: Optional[str] = typer.Option(
        None, "--mission", "-m", help="mission name or id"
    ),
) -> None:
    client = AuthenticatedClient()

    _files = [to_name_or_uuid(f) for f in files or []]
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission) if mission else None

    client = AuthenticatedClient()
    file_spec = get_valid_file_spec(_files, mission=_mission, project=_project)
    parsed_files = get_files_by_file_spec(client, file_spec)

    if get_shared_state().verbose:
        table = files_to_table(parsed_files)
        console = Console()
        console.print(table)
    else:
        for file in parsed_files:
            print(file.id)


@list_typer.command()
def projects() -> None:
    client = AuthenticatedClient()
    projects = get_projects(client)

    if get_shared_state().verbose:
        table = projects_to_table(projects)
        console = Console()
        console.print(table)
    else:
        for project in projects:
            print(project.id)


@list_typer.command()
def missions(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project name"),
    metadata: Optional[List[str]] = typer.Argument(None, help="tag=value pairs"),
) -> None:
    client = AuthenticatedClient()

    _metadata = _parse_metadata(metadata or [])
    missions = get_missions(client, project=project, tags=_metadata)

    if get_shared_state().verbose:
        table = missions_to_table(missions)
        console = Console()
        console.print(table)
    else:
        for mission in missions:
            print(mission.id)
