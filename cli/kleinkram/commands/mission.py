from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_mission_by_spec
from kleinkram.api.routes import update_mission_metadata
from kleinkram.errors import MissionDoesNotExist
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import load_metadata
from kleinkram.utils import to_name_or_uuid

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
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission) if mission else None

    client = AuthenticatedClient()

    mission_spec = get_valid_mission_spec(_mission, _project)
    mission_parsed = get_mission_by_spec(client, mission_spec)

    if mission_parsed is None:
        raise MissionDoesNotExist(f"Mission {mission} does not exist")

    metadata_dct = load_metadata(Path(metadata))
    update_mission_metadata(client, mission_parsed.id, metadata_dct)


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def create() -> None:
    raise NotImplementedError("Not implemented yet")


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def delete() -> None:
    raise NotImplementedError("Not implemented yet")
