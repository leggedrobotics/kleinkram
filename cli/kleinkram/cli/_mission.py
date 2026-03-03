from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_mission
from kleinkram.api.routes import get_project
from kleinkram.config import get_shared_state
from kleinkram.errors import InvalidMissionQuery
from kleinkram.printing import print_mission_info
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

CREATE_HELP = "create a mission"
UPDATE_HELP = "update a mission"
DELETE_HELP = "delete a mission"
MIGRATE_HELP = "migrate a mission to another project"
INFO_HELP = "get information about a mission"
NOT_IMPLEMENTED_YET = """\
Not implemented yet, open an issue if you want specific functionality
"""

mission_typer = typer.Typer(no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]})


@mission_typer.command(help=CREATE_HELP)
def create(
    project: str = typer.Option(..., "--project", "-p", help="project id or name"),
    mission_name: str = typer.Option(..., "--mission", "-m", help="mission name"),
    metadata: Optional[str] = typer.Option(None, help="path to metadata file (json or yaml)"),
    ignore_missing_tags: bool = typer.Option(False, help="ignore mission tags"),
) -> None:
    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    metadata_dct = load_metadata(Path(metadata)) if metadata else {}  # noqa

    client = AuthenticatedClient()
    project = get_project(client, project_query, exact_match=True)
    project_id = project.id
    project_required_tags = project.required_tags
    mission_id = kleinkram.api.routes._create_mission(
        client,
        project_id,
        mission_name,
        metadata=metadata_dct,
        ignore_missing_tags=ignore_missing_tags,
        required_tags=project_required_tags,
    )

    mission_parsed = get_mission(client, MissionQuery(ids=[mission_id]))
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=INFO_HELP)
def info(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
) -> None:
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    client = AuthenticatedClient()
    mission_parsed = get_mission(client, mission_query)
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=UPDATE_HELP)
def update(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    metadata: str = typer.Option(help="path to metadata file (json or yaml)"),
) -> None:
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    metadata_dct = load_metadata(Path(metadata))

    client = AuthenticatedClient()
    mission_id = get_mission(client, mission_query).id
    kleinkram.core.update_mission(client=client, mission_id=mission_id, metadata=metadata_dct)

    mission_parsed = get_mission(client, mission_query)
    print_mission_info(mission_parsed, pprint=get_shared_state().verbose)


@mission_typer.command(help=DELETE_HELP)
def delete(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    confirm: bool = typer.Option(False, "--confirm", "-y", "--yes", help="confirm deletion"),
) -> None:
    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    mission_ids, mission_patterns = split_args([mission])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )
    if mission_patterns and not (project_patterns or project_ids):
        raise InvalidMissionQuery(
            "Mission query does not uniquely determine mission. "
            "Project name or id must be specified when deleting by mission name"
        )

    client = AuthenticatedClient()
    mission_parsed = get_mission(client, mission_query)
    if not confirm:
        if project:
            typer.confirm(f"delete {project} {mission}", abort=True)
        else:
            typer.confirm(f"delete {mission_parsed.name} {mission}", abort=True)

    kleinkram.core.delete_mission(client=client, mission_id=mission_parsed.id)


@mission_typer.command(help=MIGRATE_HELP)
def migrate(
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    target_project: str = typer.Option(
        ...,
        "--target-project",
        "-t",
        help="target project id or name",
    ),
    source_project: Optional[str] = typer.Option(
        None,
        "--source-project",
        "-p",
        help="source project id or name (required when --mission is a name)",
    ),
    new_name: Optional[str] = typer.Option(None, "--new-name", "-n", help="optional new mission name in target project"),
) -> None:
    client = AuthenticatedClient()

    source_project_query = ProjectQuery()
    if source_project:
        source_project_ids, source_project_patterns = split_args([source_project])
        source_project_query = ProjectQuery(
            ids=source_project_ids,
            patterns=source_project_patterns,
        )
        source_project_uuid = get_project(
            client=client,
            query=source_project_query,
            exact_match=True,
        ).id
        source_project_query = ProjectQuery(ids=[source_project_uuid])

    mission_ids, mission_patterns = split_args([mission])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=source_project_query,
    )
    if mission_patterns and not source_project:
        raise InvalidMissionQuery(
            "Mission query does not uniquely determine mission. "
            "Source project name or id must be specified when migrating by mission name"
        )

    target_project_ids, target_project_patterns = split_args([target_project])
    target_project_query = ProjectQuery(
        ids=target_project_ids,
        patterns=target_project_patterns,
    )

    mission_parsed = get_mission(client, mission_query)
    target_project_parsed = get_project(client, target_project_query, exact_match=True)
    kleinkram.core.migrate_mission(
        client=client,
        mission_id=mission_parsed.id,
        target_project_id=target_project_parsed.id,
        new_name=new_name,
    )

    migrated_mission = get_mission(client, MissionQuery(ids=[mission_parsed.id]))
    print_mission_info(migrated_mission, pprint=get_shared_state().verbose)


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def prune(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
) -> None:
    """\
    delete files with bad file states, e.g. missing not uploaded corrupted etc.
    TODO: open for suggestions what this should do
    """

    raise NotImplementedError("Not implemented yet")
