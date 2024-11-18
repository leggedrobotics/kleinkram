from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from uuid import UUID

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import upload_files
from kleinkram.api.routes import create_mission
from kleinkram.api.routes import get_mission_by_id
from kleinkram.api.routes import get_mission_by_spec
from kleinkram.api.routes import get_project_id_by_name
from kleinkram.api.routes import get_tags_map
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionDoesNotExist
from kleinkram.models import MissionByName
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import load_metadata
from kleinkram.utils import to_name_or_uuid
from rich.console import Console


HELP = """\
Upload files to kleinkram.
"""

upload_typer = typer.Typer(
    name="upload",
    no_args_is_help=True,
    invoke_without_command=True,
    help=HELP,
)


@upload_typer.callback()
def upload(
    files: List[str] = typer.Argument(help="files to upload"),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project id or name"
    ),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    create: bool = typer.Option(False, help="create mission if it does not exist"),
    metadata: Optional[str] = typer.Option(
        None, help="path to metadata file (json or yaml)"
    ),
    fix_filenames: bool = typer.Option(False, help="fix filenames"),
    ignore_missing_tags: bool = typer.Option(False, help="ignore mission tags"),
) -> None:
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission)

    client = AuthenticatedClient()

    # check files and `fix` filenames
    if files is None:
        files = []

    file_paths = [Path(file) for file in files]
    check_file_paths(file_paths)

    files_map = get_filename_map(
        [Path(file) for file in files],
    )

    if not fix_filenames:
        for name, path in files_map.items():
            if name != path.name:
                raise ValueError(
                    f"invalid filename format {path.name}, use `--fix-filenames`"
                )

    # parse the mission spec and get mission
    mission_spec = get_valid_mission_spec(_mission, _project)
    mission_parsed = get_mission_by_spec(client, mission_spec)

    if not create and mission_parsed is None:
        raise MissionDoesNotExist(f"mission: {mission} does not exist, use `--create`")

    # create missing mission
    if mission_parsed is None:
        if not isinstance(mission_spec, MissionByName):
            raise ValueError(
                "cannot create mission using mission id, pecify a mission name"
            )

        # get the metadata
        tags_dct = {}
        if metadata is not None:
            metadata_dct = load_metadata(Path(metadata))
            tags_dct = get_tags_map(client, metadata_dct)

        # get project id
        if isinstance(mission_spec.project, UUID):
            project_id = mission_spec.project
        else:
            project_id = get_project_id_by_name(client, mission_spec.project)
            if project_id is None:
                raise ValueError(
                    f"unable to create mission, project: {mission_spec.project} not found"
                )

        mission_id = create_mission(
            client,
            project_id,
            mission_spec.name,
            tags=tags_dct,
            ignore_missing_tags=ignore_missing_tags,
        )

        mission_parsed = get_mission_by_id(client, mission_id)
        assert mission_parsed is not None, "unreachable"

    filtered_files_map = {}
    remote_file_names = [file.name for file in mission_parsed.files]

    console = Console()
    for name, path in files_map.items():
        if name in remote_file_names:
            console.print(
                f"file: {name} (path: {path}) already exists in mission", style="yellow"
            )
        else:
            filtered_files_map[name] = path

    if not filtered_files_map:
        console.print("\nNO FILES UPLOADED", style="yellow")
        return

    upload_files(
        filtered_files_map,
        mission_parsed.id,
        n_workers=2,
        verbose=get_shared_state().verbose,
    )
