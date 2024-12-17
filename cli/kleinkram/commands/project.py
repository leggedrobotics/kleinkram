from __future__ import annotations

import typer
from rich.console import Console

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import ProjectSpec
from kleinkram.api.resources import get_project
from kleinkram.models import project_info_table
from kleinkram.utils import split_args

project_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)


NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

CREATE_HELP = "create a project"
DELETE_HELP = "delete a project"
INFO_HELP = "get information about a project"


@project_typer.command(help=CREATE_HELP)
def create(
    project: str = typer.Option(..., "--project", "-p", help="project name")
) -> None:
    kleinkram.api.routes._create_project(AuthenticatedClient(), project)


@project_typer.command(help=NOT_IMPLEMENTED_YET)
def update() -> None:
    raise NotImplementedError(NOT_IMPLEMENTED_YET)


@project_typer.command(help=DELETE_HELP)
def delete(
    project: str = typer.Option(..., "--project", "-p", help="project id or name")
) -> None:
    project_ids, project_patterns = split_args([project])
    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_id = get_project(client=client, spec=project_spec).id
    kleinkram.core.delete_project(client=client, project_id=project_id)


@project_typer.command(help=INFO_HELP)
def info(
    project: str = typer.Option(..., "--project", "-p", help="project id or name")
) -> None:
    project_ids, project_patterns = split_args([project])
    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_parsed = get_project(client=client, spec=project_spec)
    # TODO: non-verbose json output, for jq piping
    Console().print(project_info_table(project_parsed))


@project_typer.command(help=NOT_IMPLEMENTED_YET)
def prune() -> None:
    raise NotImplementedError(NOT_IMPLEMENTED_YET)
