"""
this file contains the main functionality of kleinkram cli
"""

from __future__ import annotations

from enum import Enum
from pathlib import Path
from typing import Collection
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from uuid import UUID

from rich.console import Console
from tqdm import tqdm

import kleinkram.api.file_transfer
import kleinkram.api.resources
import kleinkram.api.routes
import kleinkram.errors
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
from kleinkram.models import FileState
from kleinkram.models import files_to_table
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename_map


class FileVerificationStatus(str, Enum):
    UPLAODED = "uploaded"
    UPLOADING = "uploading"
    COMPUTING_HASH = "computing hash"
    MISSING = "missing"
    MISMATCHED_HASH = "hash mismatch"
    UNKNOWN = "unknown"


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


def download(
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
    files = list(get_files(client, spec))
    paths = _file_desitations(files, dest=base_dir, allow_nested=nested)

    if verbose:
        table = files_to_table(files, title="downloading files...")
        Console().print(table)

    kleinkram.api.file_transfer.download_files(
        client, paths, verbose=verbose, overwrite=overwrite
    )


def upload(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    file_paths: Sequence[Path],
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
    check_file_paths(file_paths)

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

    filename_map = get_filename_map(file_paths)
    kleinkram.api.file_transfer.upload_files(
        client, filename_map, mission.id, verbose=verbose
    )


def verify(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    file_paths: Sequence[Path],
    skip_hash: bool = False,
    verbose: bool = False,
) -> Dict[Path, FileVerificationStatus]:
    # check that file paths are for valid files and have valid suffixes
    check_file_paths(file_paths)

    # check that the mission exists
    _ = get_mission(client, spec)

    remote_files = {
        f.name: f for f in get_files(client, spec=FileSpec(mission_spec=spec))
    }
    filename_map = get_filename_map(file_paths)

    # verify files
    file_status: Dict[Path, FileVerificationStatus] = {}
    for name, file in tqdm(
        filename_map.items(),
        desc="verifying files",
        unit="file",
        disable=not verbose,
    ):
        if name not in remote_files:
            file_status[file] = FileVerificationStatus.MISSING
            continue

        remote_file = remote_files[name]

        if remote_file.state == FileState.UPLOADING:
            file_status[file] = FileVerificationStatus.UPLOADING
        elif remote_file.state == FileState.OK:
            if remote_file.hash is None:
                file_status[file] = FileVerificationStatus.COMPUTING_HASH
            elif skip_hash or remote_file.hash == b64_md5(file):
                file_status[file] = FileVerificationStatus.UPLAODED
            else:
                file_status[file] = FileVerificationStatus.MISMATCHED_HASH
        else:
            file_status[file] = FileVerificationStatus.UNKNOWN
    return file_status


def update_file(*, client: AuthenticatedClient, file_id: UUID) -> None:
    """\
    TODO: what should this even do
    """
    _ = client, file_id
    raise NotImplementedError("if you have an idea what this should do, open an issue")


def update_mission(
    *, client: AuthenticatedClient, mission_id: UUID, metadata: Dict[str, str]
) -> None:
    # TODO: this funciton will do more than just overwirte the metadata in the future
    kleinkram.api.routes._update_mission_metadata(client, mission_id, metadata=metadata)


def update_project(
    *, client: AuthenticatedClient, project_id: UUID, description: Optional[str] = None
) -> None:
    """\
    TODO: what should this do?
    """
    _ = client, project_id, description
    raise NotImplementedError("if you have an idea what this should do, open an issue")


def delete_files(*, client: AuthenticatedClient, file_ids: Collection[UUID]) -> None:
    """\
    deletes multiple files accross multiple missions
    """
    files = kleinkram.api.resources.get_files(client, FileSpec(ids=list(file_ids)))
    found_ids = [f.id for f in files]
    for file_id in file_ids:
        if file_id not in found_ids:
            raise kleinkram.errors.FileNotFound(
                f"file {file_id} not found, did not delete any files"
            )

    # we can only batch delete files within the same mission
    missions_to_files: Dict[UUID, List[UUID]] = {}
    for file in files:
        if file.mission_id not in missions_to_files:
            missions_to_files[file.mission_id] = []
        missions_to_files[file.mission_id].append(file.id)

    for mission_id, file_ids in missions_to_files.items():
        kleinkram.api.routes._delete_files(
            client, file_ids=file_ids, mission_id=mission_id
        )


def delete_mission(*, client: AuthenticatedClient, mission_id: UUID) -> None:
    mspec = MissionSpec(ids=[mission_id])
    mission = get_mission(client, mspec)
    files = list(get_files(client, spec=FileSpec(mission_spec=mspec)))

    # delete the files and then the mission
    kleinkram.api.routes._delete_files(client, [f.id for f in files], mission.id)
    kleinkram.api.routes._delete_mission(client, mission_id)


def delete_project(*, client: AuthenticatedClient, project_id: UUID) -> None:
    pspec = ProjectSpec(ids=[project_id])
    _ = get_project(client, pspec)  # check if project exists

    # delete all missions and files
    missions = list(get_missions(client, spec=MissionSpec(project_spec=pspec)))
    for mission in missions:
        delete_mission(client=client, mission_id=mission.id)
