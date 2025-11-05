"""
this file contains the main functionality of kleinkram cli

- download
- upload
- verify
- update_file
- update_mission
- update_project
- delete_files
- delete_mission
- delete_project
"""

from __future__ import annotations

from pathlib import Path
from typing import Collection
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from uuid import UUID

import httpx
from rich.console import Console
from tqdm import tqdm

import kleinkram.api.file_transfer
import kleinkram.api.routes
import kleinkram.errors
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.query import check_mission_query_is_creatable
from kleinkram.errors import InvalidFileQuery
from kleinkram.errors import MissionNotFound
from kleinkram.models import FileState
from kleinkram.models import FileVerificationStatus
from kleinkram.printing import files_to_table
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import file_paths_from_files
from kleinkram.utils import get_filename_map


def download(
    *,
    client: AuthenticatedClient,
    query: FileQuery,
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
    try:
        files = list(kleinkram.api.routes.get_files(client, file_query=query))
    except httpx.HTTPStatusError:
        raise InvalidFileQuery(
            f"Files not found. Maybe you forgot to specify mission or project flags: {query}"
        )
    paths = file_paths_from_files(files, dest=base_dir, allow_nested=nested)

    if verbose:
        table = files_to_table(files, title="downloading files...")
        Console().print(table)

    kleinkram.api.file_transfer.download_files(
        client, paths, verbose=verbose, overwrite=overwrite
    )


def upload(
    *,
    client: AuthenticatedClient,
    query: MissionQuery,
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
        mission = kleinkram.api.routes.get_mission(client, query=query)
    except MissionNotFound:
        if not create:
            raise
        mission = None

    if create and mission is None:
        # check if project exists and get its id at the same time
        project = kleinkram.api.routes.get_project(
            client, query=query.project_query, exact_match=True
        )
        project_id = project.id
        project_required_tags = project.required_tags
        mission_name = check_mission_query_is_creatable(query)
        kleinkram.api.routes._create_mission(
            client,
            project_id,
            mission_name,
            metadata=metadata or {},
            ignore_missing_tags=ignore_missing_metadata,
            required_tags=project_required_tags,
        )
        mission = kleinkram.api.routes.get_mission(client, query)

    assert mission is not None, "unreachable"

    filename_map = get_filename_map(file_paths)
    kleinkram.api.file_transfer.upload_files(
        client, filename_map, mission.id, verbose=verbose
    )


def verify(
    *,
    client: AuthenticatedClient,
    query: MissionQuery,
    file_paths: Sequence[Path],
    skip_hash: Optional[bool] = None,
    check_file_hash: bool = True,
    check_file_size: bool = False,
    verbose: bool = False,
) -> Dict[Path, FileVerificationStatus]:

    # add deprecated warning for skip_hash
    if skip_hash is not None:
        print(
            "Warning: --skip-hash is deprecated and will be removed in a future version. "
            "Use --check-file-hash=False instead.",
        )
        check_file_hash = not skip_hash

    # check that file paths are for valid files and have valid suffixes
    check_file_paths(file_paths)

    # check that the mission exists
    _ = kleinkram.api.routes.get_mission(client, query)

    remote_files = {
        f.name: f
        for f in kleinkram.api.routes.get_files(
            client, file_query=FileQuery(mission_query=query)
        )
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

            # default case, will be overwritten if we find a mismatch
            file_status[file] = FileVerificationStatus.UPLOADED

            if check_file_size:
                if remote_file.size == file.stat().st_size:
                    file_status[file] = FileVerificationStatus.UPLOADED
                else:
                    file_status[file] = FileVerificationStatus.MISMATCHED_SIZE

            if file_status[file] != FileVerificationStatus.UPLOADED:
                continue  # abort if we already found a mismatch

            if check_file_hash:
                if remote_file.hash is None:
                    file_status[file] = FileVerificationStatus.COMPUTING_HASH
                elif remote_file.hash == b64_md5(file):
                    file_status[file] = FileVerificationStatus.UPLOADED
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
    kleinkram.api.routes._update_mission(client, mission_id, metadata=metadata)


def update_project(
    *,
    client: AuthenticatedClient,
    project_id: UUID,
    description: Optional[str] = None,
    new_name: Optional[str] = None,
) -> None:
    # TODO: this function should do more in the future
    kleinkram.api.routes._update_project(
        client, project_id, description=description, new_name=new_name
    )


def delete_files(*, client: AuthenticatedClient, file_ids: Collection[UUID]) -> None:
    """\
    deletes multiple files accross multiple missions
    """
    if not file_ids:
        return

    # we need to check that file_ids is not empty, otherwise this is bad
    files = list(kleinkram.api.routes.get_files(client, FileQuery(ids=list(file_ids))))

    # check if all file_ids were actually found
    found_ids = [f.id for f in files]
    for file_id in file_ids:
        if file_id not in found_ids:
            raise kleinkram.errors.FileNotFound(
                f"file {file_id} not found, did not delete any files"
            )

    # to prevent catastrophic mistakes from happening *again*
    assert set(file_ids) == set([file.id for file in files]), "unreachable"

    # we can only batch delete files within the same mission
    missions_to_files: Dict[UUID, List[UUID]] = {}
    for file in files:
        if file.mission_id not in missions_to_files:
            missions_to_files[file.mission_id] = []
        missions_to_files[file.mission_id].append(file.id)

    for mission_id, ids_ in missions_to_files.items():
        kleinkram.api.routes._delete_files(client, file_ids=ids_, mission_id=mission_id)


def delete_mission(*, client: AuthenticatedClient, mission_id: UUID) -> None:
    mquery = MissionQuery(ids=[mission_id])
    mission = kleinkram.api.routes.get_mission(client, mquery)
    files = list(
        kleinkram.api.routes.get_files(
            client, file_query=FileQuery(mission_query=mquery)
        )
    )

    # delete the files and then the mission
    kleinkram.api.routes._delete_files(client, [f.id for f in files], mission.id)
    kleinkram.api.routes._delete_mission(client, mission_id)


def delete_project(*, client: AuthenticatedClient, project_id: UUID) -> None:
    pquery = ProjectQuery(ids=[project_id])
    _ = kleinkram.api.routes.get_project(
        client, pquery, exact_match=True
    )  # check if project exists

    # delete all missions and files
    missions = list(
        kleinkram.api.routes.get_missions(
            client, mission_query=MissionQuery(project_query=pquery)
        )
    )
    for mission in missions:
        delete_mission(client=client, mission_id=mission.id)

    # delete the project
    kleinkram.api.routes._delete_project(client, project_id)
