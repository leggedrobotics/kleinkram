"""
this file contains the main functionality of kleinkram cli
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict
from typing import Optional
from typing import Sequence
from uuid import UUID

import kleinkram.api.resources
import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import FileSpec
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.api.resources import check_mission_spec_is_creatable
from kleinkram.api.resources import get_files
from kleinkram.api.resources import get_mission
from kleinkram.api.resources import get_missions
from kleinkram.api.resources import get_project
from kleinkram.api.routes import _create_mission
from kleinkram.models import File


def _file_desitations(
    files: Sequence[File], *, dest: Path, allow_nested: bool = False
) -> Dict[Path, File]:
    if (
        len(set([(file.project_id, file.mission_id) for file in files])) > 1
        and not allow_nested
    ):
        raise ValueError("files from multiple missions were selected")
    elif not allow_nested:
        return {dest / file.name: file for file in files}
    else:
        return {
            dest / file.project_name / file.mission_name / file.name: file
            for file in files
        }


def _download(
    *,
    client: AuthenticatedClient,
    spec: FileSpec,
    dest: Path,
    nested: bool = False,
    overwrite: bool = False,
) -> None:
    client = AuthenticatedClient()
    files = list(get_files(client, spec))
    path_map = _file_desitations(files, dest=dest, allow_nested=nested)

    for path, file in path_map.items():
        ...

    raise NotImplementedError


def _upload(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    files: Sequence[Path],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None:
    if metadata is None:
        metadata = {}

    if create:
        name = check_mission_spec_is_creatable(spec)
        project = get_project(client, spec.project_spec)
        _create_mission(
            client,
            project.id,
            name,
            metadata=metadata,
            ignore_missing_tags=ignore_missing_metadata,
        )

    if fix_filenames:
        ...

    raise NotImplementedError


def _verify(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    files: Sequence[Path],
    skip_hash: bool = False,
    fix_filenames: bool = False,
) -> None:
    raise NotImplementedError


def _update_file(*, client: AuthenticatedClient, file_id: UUID) -> None:
    """\
    TODO: what should this even do
    """
    raise NotImplementedError


def _update_mission(
    *, client: AuthenticatedClient, mission_id: UUID, metadata: Dict[str, str]
) -> None:
    raise NotImplementedError


def _update_project(
    *, client: AuthenticatedClient, project_id: UUID, description: Optional[str] = None
) -> None:
    raise NotImplementedError


def _delete_mission(*, client: AuthenticatedClient, mission_id: UUID) -> None:
    mspec = MissionSpec(ids=[mission_id])
    mission = get_mission(client, mspec)
    files = list(get_files(client, spec=FileSpec(mission_spec=mspec)))

    # delete the files and then the mission
    kleinkram.api.routes._delete_files(client, [f.id for f in files], mission.id)
    kleinkram.api.routes._delete_mission(client, mission_id)


def _delete_project(*, client: AuthenticatedClient, project_id: UUID) -> None:
    pspec = ProjectSpec(ids=[project_id])
    _ = get_project(client, pspec)  # check if project exists

    # delete all missions and files
    missions = list(get_missions(client, spec=MissionSpec(project_spec=pspec)))
    for mission in missions:
        _delete_mission(client, mission.id)
