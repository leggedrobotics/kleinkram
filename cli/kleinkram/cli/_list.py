from __future__ import annotations

from typing import List
from typing import Optional

import typer

from kleinkram.cli._deprecation import warn_deprecated

HELP = """\
List projects, missions, or files.

Deprecated, use `klein project list`, `klein mission list` and `klein file list` instead.
"""

list_typer = typer.Typer(name="list", invoke_without_command=True, help=HELP, no_args_is_help=True)


@list_typer.command()
def files(
    files: Optional[List[str]] = typer.Argument(
        None,
        help="file names, ids or patterns",
    ),
    projects: Optional[List[str]] = typer.Option(None, "--project", "-p", help="project name or id"),
    missions: Optional[List[str]] = typer.Option(None, "--mission", "-m", help="mission name or id"),
) -> None:
    from kleinkram.cli._file import list_files

    warn_deprecated("`klein list files`", "`klein file list`")

    list_files(
        files=files, projects=projects, missions=missions, include_canceled=False, include_states=None, exclude_states=None
    )


@list_typer.command()
def missions(
    projects: Optional[List[str]] = typer.Option(None, "--project", "-p", help="project name or id"),
    missions: Optional[List[str]] = typer.Argument(None, help="mission names"),
) -> None:
    from kleinkram.cli._mission import list_missions

    warn_deprecated("`klein list missions`", "`klein mission list`")

    list_missions(projects=projects, missions=missions)


@list_typer.command()
def projects(
    projects: Optional[List[str]] = typer.Argument(None, help="project names"),
) -> None:
    from kleinkram.cli._project import list_projects

    warn_deprecated("`klein list projects`", "`klein project list`")

    list_projects(projects=projects)
