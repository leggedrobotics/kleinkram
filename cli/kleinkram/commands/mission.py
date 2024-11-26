from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import _update_mission_metadata
from kleinkram.errors import MissionNotFound
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.resources import get_missions
from kleinkram.resources import mission_spec_is_unique
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

mission_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)


UPDATE_HELP = """\
Update a mission.
"""

NOT_IMPLEMENTED_YET = "Not implemented yet"


@mission_typer.command(help=UPDATE_HELP)
def update(
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project id or name"
    ),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    metadata: str = typer.Option(help="path to metadata file (json or yaml)"),
) -> None:
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)
    mission_spec = MissionSpec(
        ids=mission_ids,
        patterns=mission_patterns,
        project_spec=project_spec,
    )

    if not mission_spec_is_unique(mission_spec):
        raise ValueError(f"mission spec is not unique: {mission_spec}")

    client = AuthenticatedClient()
    missions = get_missions(client, mission_spec)

    if not missions:
        raise MissionNotFound(f"Mission {mission} does not exist")
    elif len(missions) > 1:
        raise RuntimeError(f"Multiple missions found: {missions}")  # unreachable

    metadata_dct = load_metadata(Path(metadata))
    _update_mission_metadata(client, missions[0].id, metadata=metadata_dct)


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def create() -> None:
    raise NotImplementedError("Not implemented yet")


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def delete() -> None:
    raise NotImplementedError("Not implemented yet")
