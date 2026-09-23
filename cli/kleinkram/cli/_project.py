from __future__ import annotations

from typing import List
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_project
from kleinkram.api.routes import get_projects
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import require
from kleinkram.config import get_shared_state
from kleinkram.printing import print_project_info
from kleinkram.printing import print_projects
from kleinkram.utils import split_args

project_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

CREATE_HELP = "create a project"
INFO_HELP = "get information about a project"
UPDATE_HELP = "update a project"
DELETE_HELP = "delete a project"


PROJECT_ARG_HELP = "project id or name"
DEPRECATED_PROJECT_FLAG = "--project/-p"


def _project_query(project: str) -> ProjectQuery:
    project_ids, project_patterns = split_args([project])
    return ProjectQuery(ids=project_ids, patterns=project_patterns)


@project_typer.command(help=CREATE_HELP, cls=CompatCommand)
def create(
    name: Optional[str] = typer.Argument(None, metavar="NAME", help="project name"),
    description: str = typer.Option(..., "--description", "-d", help="project description"),
    project_flag: Optional[str] = typer.Option(None, "--project", "-p", hidden=True),
) -> None:
    name = require(prefer_new(name, project_flag, old=DEPRECATED_PROJECT_FLAG, new="the positional NAME argument"), "NAME")

    client = AuthenticatedClient()
    project_id = kleinkram.core.create_project(client, name, description)

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=INFO_HELP, cls=CompatCommand)
def info(
    project: Optional[str] = typer.Argument(None, metavar="PROJECT", help=PROJECT_ARG_HELP),
    project_flag: Optional[str] = typer.Option(None, "--project", "-p", hidden=True),
) -> None:
    project = require(
        prefer_new(project, project_flag, old=DEPRECATED_PROJECT_FLAG, new="the positional PROJECT argument"), "PROJECT"
    )

    client = AuthenticatedClient()
    project_parsed = get_project(client=client, query=_project_query(project))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=UPDATE_HELP, cls=CompatCommand)
def update(
    project: Optional[str] = typer.Argument(None, metavar="PROJECT", help=PROJECT_ARG_HELP),
    description: Optional[str] = typer.Option(None, "--description", "-d", help="new project description"),
    new_name: Optional[str] = typer.Option(None, "--name", "-n", help="new project name"),
    project_flag: Optional[str] = typer.Option(None, "--project", "-p", hidden=True),
    new_name_flag: Optional[str] = typer.Option(None, "--new-name", hidden=True),
) -> None:
    project = require(
        prefer_new(project, project_flag, old=DEPRECATED_PROJECT_FLAG, new="the positional PROJECT argument"), "PROJECT"
    )
    new_name = prefer_new(new_name, new_name_flag, old="--new-name", new="--name")
    if description is None and new_name is None:
        raise typer.BadParameter("nothing to update, provide --description or --name")

    client = AuthenticatedClient()
    project_id = get_project(client=client, query=_project_query(project), exact_match=True).id
    kleinkram.core.update_project(client=client, project_id=project_id, description=description, new_name=new_name)

    project_parsed = get_project(client, ProjectQuery(ids=[project_id]))
    print_project_info(project_parsed, pprint=get_shared_state().verbose)


@project_typer.command(help=DELETE_HELP, cls=CompatCommand)
def delete(
    project: Optional[str] = typer.Argument(None, metavar="PROJECT", help=PROJECT_ARG_HELP),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
    project_flag: Optional[str] = typer.Option(None, "--project", "-p", hidden=True),
) -> None:
    project = require(
        prefer_new(project, project_flag, old=DEPRECATED_PROJECT_FLAG, new="the positional PROJECT argument"), "PROJECT"
    )

    client = AuthenticatedClient()
    project_parsed = get_project(client=client, query=_project_query(project), exact_match=True)
    confirm_deletion(f"delete project {project_parsed.name} ({project_parsed.id})", yes=yes, legacy_no_prompt=True)
    kleinkram.core.delete_project(client=client, project_id=project_parsed.id)


@project_typer.command(help=NOT_IMPLEMENTED_YET)
def prune() -> None:
    raise NotImplementedError(NOT_IMPLEMENTED_YET)


@project_typer.command(name="list", help="list projects")
def list_projects(
    projects: Optional[List[str]] = typer.Argument(None, help="project names, ids or patterns"),
) -> None:
    project_ids, project_patterns = split_args(projects or [])
    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)

    client = AuthenticatedClient()
    parsed_projects = list(get_projects(client, project_query=project_query))
    print_projects(parsed_projects, pprint=get_shared_state().verbose)
