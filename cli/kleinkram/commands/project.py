from __future__ import annotations

import sys

import httpx
import typer
from rich.console import Console
from rich.table import Table
from typing_extensions import Annotated

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import create_project as _create_project
from kleinkram.api.routes import get_project
from kleinkram.api.routes import get_projects_filtered
from kleinkram.models import projects_to_table

project_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)


@project_typer.command("list")
def list_projects(
    verbose: Annotated[bool, typer.Option()] = False,
) -> None:
    client = AuthenticatedClient()
    projects = get_projects_filtered(client)

    if not projects:
        print("No projects found", file=sys.stderr)
        return

    if not verbose:
        for project in projects:
            print(" - ", file=sys.stderr, end="")
            print(project.id, file=sys.stdout)
    else:
        table = projects_to_table(projects)
        console = Console()
        console.print(table)


@project_typer.command("details")
def details(
    id: Annotated[str, typer.Argument(help="UUID of the project to get details of")],
    verbose: Annotated[bool, typer.Option()] = False,
):
    client = AuthenticatedClient()
    _, details = get_project(client, id)

    if details is None:
        raise RuntimeError(f"Project with ID: {id} not found")

    print(f"Details of project with ID {id}:", file=sys.stderr)

    if not verbose:
        for mission in details.get("missions", []):
            print(" - ", file=sys.stderr, end="")
            print(mission.get("uuid", 0), file=sys.stdout)
    else:
        console = Console()
        console.print(details)


@project_typer.command("create", no_args_is_help=True, help="Create a new project")
def create_project(
    name: Annotated[str, typer.Option(help="Name of Project")],
    description: Annotated[str, typer.Option(help="Description of Project")],
):
    client = AuthenticatedClient()
    project_id = _create_project(client, name, description=description)

    # TODO: stderr and stdout piping
    print(f"Project '{name}' created successfully with UUID: {project_id}")


@project_typer.command("delete", help="Delete a project")
def delete_project():
    raise NotImplementedError()
