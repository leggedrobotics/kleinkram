from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from typing import Union
from uuid import UUID

import typer
from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import get_file
from kleinkram.api.routes import get_mission_by_id
from kleinkram.api.routes import get_mission_id_by_name
from kleinkram.api.routes import get_project_id_by_name
from kleinkram.config import get_shared_state
from kleinkram.api.file_transfer import download_file
from kleinkram.models import File
from kleinkram.models import files_to_table
from kleinkram.models import Mission
from kleinkram.utils import FilesById
from kleinkram.utils import FilesByMission
from kleinkram.utils import get_valid_file_spec
from kleinkram.utils import MissionById
from kleinkram.utils import MissionByName
from kleinkram.utils import to_name_or_uuid


download_typer = typer.Typer(
    name="download", no_args_is_help=True, invoke_without_command=True
)


def _get_mission_by_spec(
    client: AuthenticatedClient, spec: Union[MissionById, MissionByName]
) -> Optional[Mission]:
    if isinstance(spec, MissionById):
        return get_mission_by_id(client, spec.id)

    if isinstance(spec.project, UUID):
        project_id = spec.project
    else:
        project_id = get_project_id_by_name(client, spec.project)
    if project_id is None:
        return None

    mission_id = get_mission_id_by_name(client, spec.name, project_id)
    if mission_id is None:
        return None

    return get_mission_by_id(client, mission_id)


def _get_files_by_file_spec(
    client: AuthenticatedClient, spec: Union[FilesByMission, FilesById]
) -> List[File]:
    if isinstance(spec, FilesById):
        return [get_file(client, file_id) for file_id in spec.ids]

    parsed_mission = _get_mission_by_spec(client, spec.mission)
    if parsed_mission is None:
        raise ValueError("mission not found")

    if spec.files:
        filtered = [
            f
            for f in parsed_mission.files
            if f.id in spec.files or f.name in spec.files
        ]
        return filtered

    return parsed_mission.files


@download_typer.callback()
def download(
    files: Optional[List[str]] = typer.Argument(
        None, help="file names, ids or patterns"
    ),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project name or id"
    ),
    mission: Optional[str] = typer.Option(
        None, "--mission", "-m", help="mission name or id"
    ),
    dest: str = typer.Option(prompt="destination", help="local path to save the files"),
) -> None:
    _files = [to_name_or_uuid(f) for f in files or []]
    _project = to_name_or_uuid(project) if project else None
    _mission = to_name_or_uuid(mission) if mission else None

    # create destionation directory
    dest_dir = Path(dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    client = AuthenticatedClient()
    file_spec = get_valid_file_spec(_files, mission=_mission, project=_project)
    parsed_files = _get_files_by_file_spec(client, file_spec)

    # check if filenames are unique
    if len(set(f.name for f in parsed_files)) != len(parsed_files):
        raise ValueError(
            "the files you are trying to download do not have unique names"
        )

    if get_shared_state().verbose:
        table = files_to_table(parsed_files, title="downloading files...")
        console = Console()
        console.print(table)

    for file in parsed_files:
        try:
            download_file(
                client,
                file_id=file.id,
                name=file.name,
                dest=dest_dir,
                hash=file.hash,
                size=file.size,
            )
        except FileExistsError:
            print(f"File {file.name} already exists in destination, skipping...")
        except Exception as e:
            print(f"Error downloading file {file.name}: {e}")
