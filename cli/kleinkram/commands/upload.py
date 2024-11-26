from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional

import typer
from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import upload_files
from kleinkram.api.routes import _create_mission as _create_mission_api
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionNotFound
from kleinkram.errors import ProjectNotFound
from kleinkram.models import Mission
from kleinkram.resources import InvalidMissionSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.resources import check_mission_spec_is_creatable
from kleinkram.resources import get_missions
from kleinkram.resources import get_projects
from kleinkram.resources import mission_spec_is_unique
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

HELP = """\
Upload files to kleinkram.
"""

upload_typer = typer.Typer(
    name="upload",
    no_args_is_help=True,
    invoke_without_command=True,
    help=HELP,
)


# TODO: move this to core
def _create_mission(
    client: AuthenticatedClient,
    mission_spec: MissionSpec,
    metadata_path: Optional[Path],
    ignore_missing_tags: bool,
) -> Mission:
    check_mission_spec_is_creatable(mission_spec)
    mission_name = mission_spec.patterns[0]

    # get the metadata
    metadata_dct = {}
    if metadata_path is not None:
        metadata_dct = load_metadata(metadata_path)

    # get project
    projects = get_projects(client, mission_spec.project_spec)

    if not projects:
        raise ProjectNotFound(f"project {mission_spec.project_spec} does not exist")
    elif len(projects) > 1:
        raise AssertionError("unreachable")

    parsed_project = projects[0]

    _create_mission_api(
        client,
        parsed_project.id,
        mission_name,
        metadata=metadata_dct,
        ignore_missing_tags=ignore_missing_tags,
    )

    missions = get_missions(client, mission_spec)
    assert len(missions) is not None, "unreachable, the ghost is back"

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
    file_paths = [Path(file) for file in files]
    check_file_paths(file_paths)

    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_spec = ProjectSpec(ids=project_ids, patterns=project_patterns)
    mission_spec = MissionSpec(
        ids=mission_ids,
        patterns=mission_patterns,
        project_spec=project_spec,
    )

    if not mission_spec_is_unique(mission_spec):
        raise InvalidMissionSpec(f"mission spec is not unique: {mission_spec}")

    client = AuthenticatedClient()
    missions = get_missions(client, mission_spec)

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

    files_map = get_filename_map(file_paths)

    if not fix_filenames:
        for name, path in files_map.items():
            if name != path.name:
                raise ValueError(
                    f"invalid filename format {path.name}, use `--fix-filenames`"
                )

    upload_files(
        client,
        files_map,
        mission_parsed.id,
        n_workers=2,
        verbose=get_shared_state().verbose,
    )
