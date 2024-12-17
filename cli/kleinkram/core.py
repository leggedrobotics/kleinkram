"""
this file contains the main functionality of kleinkram cli
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from uuid import UUID

from rich.console import Console

import kleinkram.api.file_transfer
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
from kleinkram.errors import MissionNotFound
from kleinkram.models import File
from kleinkram.models import files_to_table
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map


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
    base_dir: Path,
    nested: bool = False,
    overwrite: bool = False,
    verbose: bool = False,
) -> None:
    """\
    downloads files, asserts that the destition dir exists
    returns the files that were downloaded

    TODO: the above is a lie, at the moment we just return all files that were found
    this might include some files that were skipped or not downloaded for some reason
    we would need to modify the `download_files` function to return this in the future
    """

    if not base_dir.exists():
        raise ValueError(f"Destination {base_dir.absolute()} does not exist")
    if not base_dir.is_dir():
        raise ValueError(f"Destination {base_dir.absolute()} is not a directory")

    # retrive files and get the destination paths
    client = AuthenticatedClient()
    files = list(get_files(client, spec))
    paths = _file_desitations(files, dest=base_dir, allow_nested=nested)

    if verbose:
        table = files_to_table(files, title="downloading files...")
        Console().print(table)

    kleinkram.api.file_transfer.download_files(
        client, paths, verbose=verbose, overwrite=overwrite
    )


def _upload(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    files: Sequence[Path],
    create: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
    verbose: bool = False,
) -> None:
    """\
    uploads files to a mission

    create a mission if it does not exist if `create` is True
    in that case you can also specify `metadata` and `ignore_missing_metadata`
    """
    # check that file paths are for valid files and have valid suffixes
    check_file_paths(files)

    try:
        mission = get_mission(client, spec)
    except MissionNotFound:
        if not create:
            raise
        mission = None

    if create and mission is None:
        # check if project exists and get its id at the same time
        project_id = get_project(client, spec.project_spec).id
        mission_name = check_mission_spec_is_creatable(spec)
        _create_mission(
            client,
            project_id,
            mission_name,
            metadata=metadata or {},
            ignore_missing_tags=ignore_missing_metadata,
        )
        mission = get_mission(client, spec)

    assert mission is not None, "unreachable"

    files_map = get_filename_map(files)
    kleinkram.api.file_transfer.upload_files(
        client, files_map, mission.id, verbose=verbose
    )


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
