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

project_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

CREATE_HELP = "create a project"
INFO_HELP = "get information about a project"
UPDATE_HELP = "update a project"
DELETE_HELP = "delete a project"
MIGRATE_HELP = "migrate all missions from one project to another"


@project_typer.command(help=CREATE_HELP)
def create(
    project: str = typer.Option(..., "--project", "-p", help="project name"),
    description: str = typer.Option(..., "--description", "-d", help="project description"),
) -> None:
    client = AuthenticatedClient()
    project_id = kleinkram.api.routes._create_project(client, project, description)

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=INFO_HELP)
def info(project: str = typer.Option(..., "--project", "-p", help="project id or name")) -> None:
    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_parsed = get_project(client=client, query=project_query)
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=UPDATE_HELP)
def update(
    project: str = typer.Option(..., "--project", "-p", help="project id or name"),
    description: Optional[str] = typer.Option(None, "--description", "-d", help="project description"),
    new_name: Optional[str] = typer.Option(None, "--new-name", "-n", "--name", help="new project name"),
) -> None:
    if description is None and new_name is None:
        raise typer.BadParameter("nothing to update, provide --description or --new-name")

    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_id = get_project(client=client, query=project_query, exact_match=True).id
    kleinkram.core.update_project(client=client, project_id=project_id, description=description, new_name=new_name)

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=DELETE_HELP)
def delete(project: str = typer.Option(..., "--project", "-p", help="project id or name")) -> None:
    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    client = AuthenticatedClient()
    project_id = get_project(client=client, query=project_query, exact_match=True).id
    kleinkram.core.delete_project(client=client, project_id=project_id)


@project_typer.command(help=MIGRATE_HELP)
def migrate(
    source_project: str = typer.Option(
        ...,
        "--source-project",
        "-s",
        help="source project id or name",
    ),
    target_project: str = typer.Option(
        ...,
        "--target-project",
        "-t",
        help="target project id or name",
    ),
    archive_source_as: Optional[str] = typer.Option(
        None,
        "--archive-source-as",
        help="optional new name for source project after migration",
    ),
) -> None:
    source_project_ids, source_project_patterns = split_args([source_project])
    target_project_ids, target_project_patterns = split_args([target_project])
    source_project_query = ProjectQuery(ids=source_project_ids, patterns=source_project_patterns)
    target_project_query = ProjectQuery(ids=target_project_ids, patterns=target_project_patterns)

    client = AuthenticatedClient()
    source_project_parsed = get_project(client=client, query=source_project_query, exact_match=True)
    target_project_parsed = get_project(client=client, query=target_project_query, exact_match=True)
    if source_project_parsed.id == target_project_parsed.id:
        raise typer.BadParameter("source and target projects must be different")

    kleinkram.core.migrate_project(
        client=client,
        source_project_id=source_project_parsed.id,
        target_project_id=target_project_parsed.id,
        archive_source_as=archive_source_as,
    )

    print_project_info(
        get_project(client, ProjectQuery(ids=[target_project_parsed.id])),
        pprint=get_shared_state().verbose,
    )


@project_typer.command(help=NOT_IMPLEMENTED_YET)
def prune() -> None:
    raise NotImplementedError(NOT_IMPLEMENTED_YET)
