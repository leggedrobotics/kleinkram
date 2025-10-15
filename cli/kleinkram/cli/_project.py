from __future__ import annotations

from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_project
from kleinkram.config import get_shared_state
from kleinkram.printing import print_project_info
from kleinkram.utils import split_args

project_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)


NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

CREATE_HELP = "create a project"
INFO_HELP = "get information about a project"
UPDATE_HELP = "update a project"
DELETE_HELP = "delete a project"


@project_typer.command(help=CREATE_HELP)
def create(
    project: str = typer.Option(..., "--project", "-p", help="project name"),
    description: str = typer.Option(
        ..., "--description", "-d", help="project description"
    ),
) -> None:
    client = AuthenticatedClient()
    project_id = kleinkram.api.routes._create_project(client, project, description)

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=INFO_HELP)
def info(
    project: str = typer.Option(..., "--project", "-p", help="project id or name")
) -> None:
    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_parsed = get_project(client=client, query=project_query)
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=UPDATE_HELP)
def update(
    project: str = typer.Option(..., "--project", "-p", help="project id or name"),
    description: Optional[str] = typer.Option(
        None, "--description", "-d", help="project description"
    ),
    new_name: Optional[str] = typer.Option(
        None, "--new-name", "-n", "--name", help="new project name"
    ),
) -> None:
    if description is None and new_name is None:
        raise typer.BadParameter(
            "nothing to update, provide --description or --new-name"
        )

    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_id = get_project(client=client, query=project_query, exact_match=True).id
    kleinkram.core.update_project(
        client=client, project_id=project_id, description=description, new_name=new_name
    )

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=DELETE_HELP)
def delete(
    project: str = typer.Option(..., "--project", "-p", help="project id or name")
) -> None:
    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_id = get_project(client=client, query=project_query, exact_match=True).id
    kleinkram.core.delete_project(client=client, project_id=project_id)


@project_typer.command(help=NOT_IMPLEMENTED_YET)
def prune() -> None:
    raise NotImplementedError(NOT_IMPLEMENTED_YET)
