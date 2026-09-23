from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_mission
from kleinkram.api.routes import get_missions
from kleinkram.api.routes import get_project
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import require
from kleinkram.cli._deprecation import warn_deprecated
from kleinkram.config import get_shared_state
from kleinkram.errors import InvalidMissionQuery
from kleinkram.printing import print_mission_info
from kleinkram.printing import print_missions
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

CREATE_HELP = "create a mission"
UPDATE_HELP = (
    "update a mission's metadata; the given fields are merged over the "
    "mission's existing metadata, fields that are not mentioned keep "
    "their current value"
)
DELETE_HELP = "delete a mission"
INFO_HELP = "get information about a mission"
NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

mission_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


MISSION_ARG_HELP = "mission id or name"
PROJECT_OPT_HELP = "project id or name, required when the mission is given by name and not unique"
DEPRECATED_MISSION_FLAG = "--mission/-m"
DEPRECATED_IGNORE_MISSING_TAGS_FLAG = "--ignore-missing-tags"


def _mission_query(mission: str, project: Optional[str]) -> MissionQuery:
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    return MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=ProjectQuery(ids=project_ids, patterns=project_patterns),
    )


@mission_typer.command(help=CREATE_HELP, cls=CompatCommand)
def create(
    name: Optional[str] = typer.Argument(None, metavar="NAME", help="mission name"),
    project: str = typer.Option(..., "--project", "-p", help="project id or name"),
    metadata: Optional[str] = typer.Option(None, help="path to metadata file (json or yaml)"),
    ignore_missing_metadata: bool = typer.Option(
        False, "--ignore-missing-metadata", help="create the mission even if metadata required by the project is missing"
    ),
    ignore_missing_tags: bool = typer.Option(False, "--ignore-missing-tags", hidden=True),
    mission_flag: Optional[str] = typer.Option(None, "--mission", "-m", hidden=True),
) -> None:
    name = require(prefer_new(name, mission_flag, old=DEPRECATED_MISSION_FLAG, new="the positional NAME argument"), "NAME")

    if ignore_missing_tags:
        warn_deprecated(DEPRECATED_IGNORE_MISSING_TAGS_FLAG, "--ignore-missing-metadata")
        ignore_missing_metadata = True

    project_ids, project_patterns = split_args([project])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    metadata_dct = load_metadata(Path(metadata)) if metadata else {}  # noqa

    client = AuthenticatedClient()
    project_parsed = get_project(client, project_query, exact_match=True)
    mission_id = kleinkram.core.create_mission(
        client,
        project_parsed.id,
        name,
        metadata=metadata_dct,
        ignore_missing_metadata=ignore_missing_metadata,
        required_metadata_types=project_parsed.required_metadata_types,
    )

    mission_parsed = get_mission(client, MissionQuery(ids=[mission_id]))
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=INFO_HELP, cls=CompatCommand)
def info(
    mission: Optional[str] = typer.Argument(None, metavar="MISSION", help=MISSION_ARG_HELP),
    project: Optional[str] = typer.Option(None, "--project", "-p", help=PROJECT_OPT_HELP),
    mission_flag: Optional[str] = typer.Option(None, "--mission", "-m", hidden=True),
) -> None:
    mission = require(
        prefer_new(mission, mission_flag, old=DEPRECATED_MISSION_FLAG, new="the positional MISSION argument"), "MISSION"
    )

    client = AuthenticatedClient()
    mission_parsed = get_mission(client, _mission_query(mission, project))
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=UPDATE_HELP, cls=CompatCommand)
def update(
    mission: Optional[str] = typer.Argument(None, metavar="MISSION", help=MISSION_ARG_HELP),
    project: Optional[str] = typer.Option(None, "--project", "-p", help=PROJECT_OPT_HELP),
    metadata: str = typer.Option(help="path to metadata file (json or yaml); merged over the existing metadata"),
    mission_flag: Optional[str] = typer.Option(None, "--mission", "-m", hidden=True),
) -> None:
    mission = require(
        prefer_new(mission, mission_flag, old=DEPRECATED_MISSION_FLAG, new="the positional MISSION argument"), "MISSION"
    )
    mission_query = _mission_query(mission, project)

    metadata_dct = load_metadata(Path(metadata))

    client = AuthenticatedClient()
    mission_id = get_mission(client, mission_query).id
    kleinkram.core.update_mission(client=client, mission_id=mission_id, metadata=metadata_dct)

    mission_parsed = get_mission(client, MissionQuery(ids=[mission_id]))
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=DELETE_HELP, cls=CompatCommand)
def delete(
    mission: Optional[str] = typer.Argument(None, metavar="MISSION", help=MISSION_ARG_HELP),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name, required when deleting by name"),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
    mission_flag: Optional[str] = typer.Option(None, "--mission", "-m", hidden=True),
    confirm_flag: bool = typer.Option(False, "--confirm", hidden=True),
) -> None:
    mission = require(
        prefer_new(mission, mission_flag, old=DEPRECATED_MISSION_FLAG, new="the positional MISSION argument"), "MISSION"
    )
    if confirm_flag:
        warn_deprecated("--confirm", "--yes/-y")
        yes = True

    mission_query = _mission_query(mission, project)
    if mission_query.patterns and not (mission_query.project_query.ids or mission_query.project_query.patterns):
        raise InvalidMissionQuery(
            "Mission query does not uniquely determine mission. "
            "Project name or id must be specified when deleting by mission name"
        )

    client = AuthenticatedClient()
    mission_parsed = get_mission(client, mission_query, strict=True)
    confirm_deletion(
        f"delete mission {mission_parsed.name} ({mission_parsed.id}) in project {mission_parsed.project_name}",
        yes=yes,
    )
    kleinkram.core.delete_mission(client=client, mission_id=mission_parsed.id)


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def prune(
    mission: Optional[str] = typer.Argument(None, metavar="MISSION", help=MISSION_ARG_HELP),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
) -> None:
    """\
    delete files with bad file states, e.g. missing not uploaded corrupted etc.
    TODO: open for suggestions what this should do
    """

    raise NotImplementedError("Not implemented yet")


@mission_typer.command(name="list", help="list missions")
def list_missions(
    projects: Optional[List[str]] = typer.Option(
        None, "--project", "-p", help="project name or id. Repeat flag for multiple values"
    ),
    missions: Optional[List[str]] = typer.Argument(None, help="mission names, ids or patterns"),
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
