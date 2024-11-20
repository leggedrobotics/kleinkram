from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from uuid import UUID

import typer
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import upload_files
from kleinkram.api.routes import create_mission
from kleinkram.api.routes import get_project_id_by_name
from kleinkram.api.routes import get_tags_map
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionDoesNotExist
from kleinkram.errors import MissionNotFound
from kleinkram.errors import ProjectNotFound
from kleinkram.models import Mission
from kleinkram.resources import check_mission_spec_is_creatable
from kleinkram.resources import get_missions_by_spec
from kleinkram.resources import get_projects_by_spec
from kleinkram.resources import InvalidMissionSpec
from kleinkram.resources import mission_spec_is_unique
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args
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


def _create_mission(
    client: AuthenticatedClient,
    mission_spec: MissionSpec,
    metadata_path: Optional[Path],
    ignore_missing_tags: bool,
) -> Mission:
    check_mission_spec_is_creatable(mission_spec)
    mission_name = mission_spec.mission_filters[0]

    # get the metadata
    tags_dct = {}
    if metadata_path is not None:
        metadata_dct = load_metadata(metadata_path)
        tags_dct = get_tags_map(client, metadata_dct)

    # get project
    projects = get_projects_by_spec(client, mission_spec.project_spec)

    if not projects:
        raise ProjectNotFound(f"project {mission_spec.project_spec} does not exist")
    elif len(projects) > 1:
        raise AssertionError("unreachable")

    parsed_project = projects[0]

    create_mission(
        client,
        parsed_project.id,
        mission_name,
        tags=tags_dct,
        ignore_missing_tags=ignore_missing_tags,
    )

    missions = get_missions_by_spec(client, mission_spec)
    if len(missions) != 1:
        raise AssertionError("unreachable")
    return missions[0]


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

    mission_ids, mission_filters = split_args([mission])
    project_ids, project_filters = split_args([project] if project else [])

    project_spec = ProjectSpec(project_ids=project_ids, project_filters=project_filters)
    mission_spec = MissionSpec(
        mission_ids=mission_ids,
        mission_filters=mission_filters,
        project_spec=project_spec,
    )

    if not mission_spec_is_unique(mission_spec):
        raise InvalidMissionSpec(f"mission spec is not unique: {mission_spec}")

    client = AuthenticatedClient()
    missions = get_missions_by_spec(client, mission_spec)

    if len(missions) > 1:
        raise AssertionError("unreachable")

    if not create and not missions:
        raise MissionNotFound(f"mission: {mission_spec} does not exist, use `--create`")

    # create mission if it does not exist
    mission_parsed = (
        missions[0]
        if missions
        else _create_mission(
            client,
            mission_spec,
            metadata_path=Path(metadata) if metadata else None,
            ignore_missing_tags=ignore_missing_tags,
        )
    )

    console = Console()
    filtered_files_map = {}
    remote_file_names = [file.name for file in mission_parsed.files]
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
