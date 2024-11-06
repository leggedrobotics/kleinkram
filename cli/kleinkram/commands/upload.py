from __future__ import annotations

from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional
from typing import Union
from uuid import UUID

import typer
import yaml

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import create_mission
from kleinkram.api.routes import get_mission_by_id
from kleinkram.api.routes import get_mission_id_by_name
from kleinkram.api.routes import get_project_id_by_name
from kleinkram.api.routes import get_upload_creditials
from kleinkram.file_transfer import upload_files
from kleinkram.models import Mission
from kleinkram.utils import get_internal_file_map
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import MissionById
from kleinkram.utils import MissionByName
from kleinkram.utils import patterns_matched

upload_typer = typer.Typer(
    name="upload",
    no_args_is_help=True,
    invoke_without_command=True,
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


class MissionDoesNotExist(Exception):
    pass


def _get_metadate(path: Path) -> Dict[str, str]:
    if not path.exists():
        raise FileNotFoundError(f"metadata file not found: {path}")
    try:
        with path.open() as f:
            return {str(k): str(v) for k, v in yaml.safe_load(f).items()}
    except Exception as e:
        raise ValueError(f"could not parse metadata file: {e}")


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
    ignore_mission_tags: bool = typer.Option(False, help="ignore mission tags"),
) -> None:
    client = AuthenticatedClient()

    mission_spec = get_valid_mission_spec(mission, project)
    mission_parsed = _get_mission_by_spec(client, mission_spec)

    if not create and mission_parsed is None:
        raise MissionDoesNotExist()

    # create missing mission
    if mission_parsed is None:
        if not isinstance(mission_spec, MissionByName):
            raise ValueError("cannot create mission using mission id, use mission name")

        # get the metadata
        metadata_dct = {}
        if metadata is not None:
            metadata_dct = _get_metadate(Path(metadata))

        # get project id
        if isinstance(mission_spec.project, UUID):
            project_id = mission_spec.project
        else:
            project_id = get_project_id_by_name(client, mission_spec.project)
            if project_id is None:
                raise ValueError(f"project: {mission_spec.project} not found")

        mission_id = create_mission(
            client,
            project_id,
            mission_spec.name,
            tags=metadata_dct,
            ignore_missing_tags=ignore_mission_tags,
        )
        mission_parsed = get_mission_by_id(client, mission_id)
        assert mission_parsed is not None, "unreachable"

    # upload files
    file_paths = list(patterns_matched(files))
    internal_filename_map = get_internal_file_names(
        file_paths, raise_on_error=not fix_filenames
    )

    if not fix_filenames:
        for external, internal in internal_filename_map.items():
            if external != internal:
                raise ValueError(
                    f"Filename '{external}' is not valid.\n"
                    " - It must only contain alphanumeric characters"
                    "underscores and hyphens.\n"
                    " - It must be between 3 and 40 characters long.\n\n"
                    "Consider using the '--fix-filenames' option "
                    "to automatically fix the filenames."
                )
    else:
        mismatched = [
            (ext, _int) for ext, _int in internal_filename_map.items() if ext != _int
        ]
        if mismatched:
            print("Fixing filenames internally...")
            for ext, _int in mismatched:
                print(f" - {ext} -> {_int}")

    # get upload credentials
    access = get_upload_creditials(
        client, list(internal_filename_map.values()), mission_parsed.id
    )

    # upload files
    upload_files(files_with_access, internal_filename_map, n_workers=4)
