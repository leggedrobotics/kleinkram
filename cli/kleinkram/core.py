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

import os
import re
import tarfile
import tempfile
from pathlib import Path
from typing import Collection
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from typing import Tuple
from typing import Union
from uuid import UUID

import httpx
import requests
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
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import split_args

NAME_REGEX = re.compile(r"^[\w\-_]{3,50}$")
DOCKER_IMAGE_REGEX = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._\-/]*(?::[a-zA-Z0-9._\-]+)?(?:@sha256:[a-fA-F0-9]{64})?$")
DOCKER_IMAGE_MAX_LENGTH = 256


def download_artifact(
    *,
    client: AuthenticatedClient,
    execution_id: str,
    output: Optional[str] = None,
    extract: bool = False,
    verbose: bool = False,
) -> str:
    """
    Download the artifacts (.tar.gz) for a finished execution.

    Args:
        execution_id: The ID of the execution to download artifacts for.
        output: Path or filename to save the artifacts to.
        extract: Automatically extract the archive after downloading.
        verbose: Print progress and extraction info.

    Returns:
        The path where the artifact was saved (or extracted).
    """

    # Fetch Execution Details
    execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)

    if not execution.artifact_url:
        raise ValueError(
            f"No artifacts found for execution {execution_id}. The execution might not be finished or artifacts expired."
        )

    if verbose:
        print(f"Downloading artifacts for execution {execution_id}...")

    # Grab the headers to determine filename and size
    try:
        with requests.get(execution.artifact_url, stream=True) as r:
            r.raise_for_status()
            headers = r.headers.copy()
    except requests.exceptions.RequestException as e:
        raise ValueError(f"Error fetching artifact headers: {e}")

    # Determine Filename
    filename = output
    if not filename:
        filename = kleinkram.api.file_transfer._get_filename_from_cd(headers.get("content-disposition"))

    if not filename:
        filename = f"{execution_id}.tar.gz"

    # If output is a directory, join with filename
    if output and os.path.isdir(output):
        filename = os.path.join(
            output,
            kleinkram.api.file_transfer._get_filename_from_cd(headers.get("content-disposition")) or f"{execution_id}.tar.gz",
        )

    total_length = int(headers.get("content-length", 0))

    filepath = Path(filename)

    # Download the file using _url_download
    kleinkram.api.file_transfer._url_download(
        url=execution.artifact_url,
        path=filepath,
        size=total_length,
        overwrite=True,  # overwrite if we run the CLI command directly
        verbose=verbose,
    )

    if verbose:
        print(f"\nSuccessfully downloaded to {filepath}")

    # Extraction Logic
    if extract:
        try:
            base_name = os.path.basename(str(filepath))
            folder_name = base_name.split(".")[0]
            parent_dir = os.path.dirname(os.path.abspath(str(filepath)))
            extract_path = os.path.join(parent_dir, folder_name)

            if verbose:
                print(f"Extracting to: {extract_path}...")

            with tarfile.open(filepath, "r:gz") as tar:
                if hasattr(tarfile, "data_filter"):
                    tar.extractall(path=extract_path, filter="data")
                else:
                    tar.extractall(path=extract_path)

            if verbose:
                print("Successfully extracted.")

            return extract_path

        except tarfile.TarError as e:
            raise ValueError(f"Failed to extract archive: {e}")

    return str(filepath)


def download(
    *,
    client: AuthenticatedClient,
    query: FileQuery,
    base_dir: Path,
    allow_corrupt_files: bool = False,
    nested: bool = False,
    overwrite: bool = False,
    verbose: bool = False,
) -> None:
    """\
    downloads files, asserts that the destination dir exists
    returns the files that were downloaded

    TODO: the above is a lie, at the moment we just return all files that were found
    this might include some files that were skipped or not downloaded for some reason
    we would need to modify the `download_files` function to return this in the future
    """

    if not base_dir.exists():
        raise ValueError(f"Destination {base_dir.absolute()} does not exist")
    if not base_dir.is_dir():
        raise ValueError(f"Destination {base_dir.absolute()} is not a directory")

    # retrieve files and get the destination paths
    try:
        files = list(kleinkram.api.routes.get_files(client, file_query=query))
    except httpx.HTTPStatusError:
        raise InvalidFileQuery(f"Files not found. Maybe you forgot to specify mission or project flags: {query}")
    paths = file_paths_from_files(files, dest=base_dir, allow_nested=nested)

    if verbose:
        table = files_to_table(files, title="downloading files...")
        Console().print(table)

    kleinkram.api.file_transfer.download_files(
        client,
        paths,
        verbose=verbose,
        allow_corrupt_files=allow_corrupt_files,
        overwrite=overwrite,
        create_parents=nested,
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
        project = kleinkram.api.routes.get_project(client, query=query.project_query, exact_match=True)
        project_id = project.id
        project_required_tags = project.required_tags
        mission_name = check_mission_query_is_creatable(query)
        create_mission(
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
    kleinkram.api.file_transfer.upload_files(client, filename_map, mission.id, verbose=verbose)


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

    remote_files = {f.name: f for f in kleinkram.api.routes.get_files(client, file_query=FileQuery(mission_query=query))}
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


def list_templates(client: AuthenticatedClient, *, latest_only: bool = True) -> List[kleinkram.models.ActionTemplate]:
    templates = kleinkram.api.routes.get_templates(client)

    if not latest_only:
        return list(templates)

    seen_names = set()
    latest_templates = []
    for template in templates:
        if template.name not in seen_names:
            seen_names.add(template.name)
            latest_templates.append(template)

    return latest_templates


def update_file(*, client: AuthenticatedClient, file_id: UUID) -> None:
    """\
    TODO: what should this even do
    """
    _ = client, file_id
    raise NotImplementedError("if you have an idea what this should do, open an issue")


def update_mission(*, client: AuthenticatedClient, mission_id: UUID, metadata: Dict[str, str]) -> None:
    tags = _get_tags_map(client, metadata)
    kleinkram.api.routes._update_mission(client, mission_id, tags=tags)


def update_project(
    *,
    client: AuthenticatedClient,
    project_id: UUID,
    description: Optional[str] = None,
    new_name: Optional[str] = None,
) -> None:
    # TODO: this function should do more in the future
    kleinkram.api.routes._update_project(client, project_id, description=description, new_name=new_name)


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
            raise kleinkram.errors.FileNotFound(f"file {file_id} not found, did not delete any files")

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


def delete_template(*, client: AuthenticatedClient, template_id: UUID) -> None:
    kleinkram.api.routes._delete_template(client, template_id)



def delete_mission(*, client: AuthenticatedClient, mission_id: UUID) -> None:
    mquery = MissionQuery(ids=[mission_id])
    mission = kleinkram.api.routes.get_mission(client, mquery)
    files = list(kleinkram.api.routes.get_files(client, file_query=FileQuery(mission_query=mquery)))

    # delete the files and then the mission
    kleinkram.api.routes._delete_files(client, [f.id for f in files], mission.id)
    kleinkram.api.routes._delete_mission(client, mission_id)


def delete_project(*, client: AuthenticatedClient, project_id: UUID) -> None:
    pquery = ProjectQuery(ids=[project_id])
    _ = kleinkram.api.routes.get_project(client, pquery, exact_match=True)  # check if project exists

    # delete all missions and files
    missions = list(kleinkram.api.routes.get_missions(client, mission_query=MissionQuery(project_query=pquery)))
    for mission in missions:
        delete_mission(client=client, mission_id=mission.id)

    # delete the project
    kleinkram.api.routes._delete_project(client, project_id)


def launch_execution(
    client: AuthenticatedClient,
    mission_query: MissionQuery,
    template: Union[str, UUID],
) -> str:
    """
    Core business logic to resolve a mission and template, and launch an execution.
    """
    # 1. Resolve Mission
    mission_obj = kleinkram.api.routes.get_mission(client, mission_query)
    mission_uuid = mission_obj.id

    # 2. Resolve Template to UUID
    template_str = str(template)
    if is_valid_uuid4(template_str):
        template_uuid = UUID(template_str)
    else:
        templates = kleinkram.api.routes.get_templates(client)
        found_template = next((t for t in templates if t.name == template_str), None)

        if not found_template:
            raise ValueError(f"Action template '{template_str}' not found.")
        template_uuid = found_template.uuid

    # 3. Launch Execution via API Route
    execution_id = kleinkram.api.routes._launch_execution(client, mission_uuid, template_uuid)
    return execution_id


def _mission_name_is_available(client: AuthenticatedClient, mission_name: str, project_id: UUID) -> bool:
    mission_query = MissionQuery(patterns=[mission_name], project_query=ProjectQuery(ids=[project_id]))
    try:
        _ = kleinkram.api.routes.get_mission(client, mission_query)
    except MissionNotFound:
        return True
    return False


def _validate_mission_name(client: AuthenticatedClient, project_id: UUID, mission_name: str) -> None:
    if not NAME_REGEX.match(mission_name):
        raise ValueError(
            "Mission name must be between 3 and 50 characters and contain only letters, numbers, dashes, and underscores."
        )

    if not _mission_name_is_available(client, mission_name, project_id):
        raise kleinkram.errors.MissionExists(f"Mission with name: `{mission_name}` already exists in project: {project_id}")

    if is_valid_uuid4(mission_name):
        raise ValueError(f"Mission name: `{mission_name}` is a valid UUIDv4, mission names must not be valid UUIDv4's")


def _project_name_is_available(client: AuthenticatedClient, project_name: str) -> bool:
    project_query = ProjectQuery(patterns=[project_name])
    try:
        _ = kleinkram.api.routes.get_project(client, project_query, exact_match=True)
    except kleinkram.errors.ProjectNotFound:
        return True
    return False


def _validate_project_name(client: AuthenticatedClient, project_name: str, description: str) -> None:
    if not NAME_REGEX.match(project_name):
        raise kleinkram.errors.ProjectValidationError(
            "Project name must be between 3 and 50 characters and contain only letters, numbers, dashes, and underscores."
        )

    if not _project_name_is_available(client, project_name):
        raise kleinkram.errors.ProjectExists(f"Project with name: `{project_name}` already exists")

    if not description:
        raise kleinkram.errors.ProjectValidationError("Project description is required")


def _validate_docker_image(image_name: str) -> None:
    if len(image_name) > DOCKER_IMAGE_MAX_LENGTH:
        raise kleinkram.errors.TemplateValidationError(
            f"Invalid Docker image name: length exceeds {DOCKER_IMAGE_MAX_LENGTH} characters."
        )
    if not DOCKER_IMAGE_REGEX.match(image_name):
        raise kleinkram.errors.TemplateValidationError(
            f"Invalid Docker image name: '{image_name}' does not match the required format."
        )


def _template_name_is_available(client: AuthenticatedClient, template_name: str) -> bool:
    resp = client.get("/templates/availability", params={"name": template_name})
    resp.raise_for_status()
    return resp.json().get("available", False)


def _validate_template_name(client: AuthenticatedClient, template_name: str, description: str) -> None:
    if not _template_name_is_available(client, template_name):
        raise kleinkram.errors.TemplateExists(f"Template with name: `{template_name}` already exists")

    if template_name.endswith(" "):
        raise kleinkram.errors.TemplateValidationError(
            f"Template name must not end with a tailing whitespace: `{template_name}`"
        )

    if not description:
        raise kleinkram.errors.TemplateValidationError("Template description is required")


def _validate_mission_created(client: AuthenticatedClient, project_id: str, mission_name: str) -> None:
    """
    validate that a mission is successfully created
    """
    mission_ids, mission_patterns = split_args([mission_name])
    project_ids, project_patterns = split_args([project_id])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )
    try:
        with tempfile.NamedTemporaryFile(suffix=".mcap", delete=False) as tmp:
            tmp.write(b"dummy content")
            tmp_path = Path(tmp.name)

        upload(
            client=client,
            query=mission_query,
            file_paths=[tmp_path],
            verbose=False,
        )

        file_query = FileQuery(
            ids=[],
            patterns=[tmp_path.name],
            mission_query=mission_query,
        )
        file_parsed = kleinkram.api.routes.get_file(client, file_query)

        delete_files(client=client, file_ids=[file_parsed.id])

    except Exception as e:
        raise kleinkram.errors.MissionValidationError(f"Mission validation failed: {e}")

    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def _validate_tag_value(tag_value, tag_datatype) -> None:
    if tag_datatype == "NUMBER":
        try:
            float(tag_value)
        except ValueError:
            raise kleinkram.errors.InvalidMissionMetadata(f"Value '{tag_value}' is not a valid NUMBER")
    elif tag_datatype == "BOOLEAN":
        if tag_value.lower() not in {"true", "false"}:
            raise kleinkram.errors.InvalidMissionMetadata(
                f"Value '{tag_value}' is not a valid BOOLEAN (expected 'true' or 'false')"
            )
    else:
        pass


def _get_metadata_type_id_by_name(client: AuthenticatedClient, tag_name: str) -> Tuple[Optional[UUID], str]:
    resp = client.get("/tag/filtered", params={"name": tag_name, "take": 1})

    if resp.status_code in (403, 404):
        return None, ""

    resp.raise_for_status()
    try:
        data = resp.json()["data"][0]
    except IndexError:
        return None, ""

    return UUID(data["uuid"], version=4), data["datatype"]


def _get_tags_map(client: AuthenticatedClient, metadata: Dict[str, str]) -> Dict[UUID, str]:
    ret = {}
    for key, val in metadata.items():
        metadata_type_id, tag_datatype = _get_metadata_type_id_by_name(client, key)
        if metadata_type_id is None:
            raise kleinkram.errors.InvalidMissionMetadata(f"metadata field: {key} does not exist")
        _validate_tag_value(val, tag_datatype)
        ret[metadata_type_id] = val
    return ret


def create_mission(
    client: AuthenticatedClient,
    project_id: UUID,
    mission_name: str,
    *,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_tags: bool = False,
    required_tags: Optional[List[str]] = None,
) -> UUID:
    if metadata is None:
        metadata = {}

    _validate_mission_name(client, project_id, mission_name)

    if required_tags and not set(required_tags).issubset(metadata.keys()):
        raise kleinkram.errors.InvalidMissionMetadata(
            f"Mission tags `{required_tags}` are required but missing from metadata: {metadata}"
        )

    tags = _get_tags_map(client, metadata)
    mission_id = kleinkram.api.routes._create_mission(
        client,
        project_id,
        mission_name,
        tags=tags,
        ignore_missing_tags=ignore_missing_tags,
    )
    _validate_mission_created(client, str(project_id), mission_name)
    return mission_id


def create_project(client: AuthenticatedClient, project_name: str, description: str) -> UUID:
    _validate_project_name(client, project_name, description)
    return kleinkram.api.routes._create_project(client, project_name, description)


def create_template(
    client: AuthenticatedClient,
    name: str,
    description: str,
    docker_image: str,
    cpu_cores: int,
    cpu_memory_gb: int,
    gpu_memory_gb: int,
    max_runtime_minutes: int,
    access_rights: int = 0,
    command: Optional[str] = None,
    entrypoint: Optional[str] = None,
) -> UUID:
    _validate_template_name(client, name, description)
    if docker_image is not None:
        _validate_docker_image(docker_image)
    if cpu_cores <= 0 or cpu_memory_gb <= 0 or gpu_memory_gb < 0 or max_runtime_minutes <= 0:
        raise ValueError("Invalid resource limits.")
    return kleinkram.api.routes._create_template(
        client,
        name,
        description,
        docker_image,
        cpu_cores,
        cpu_memory_gb,
        gpu_memory_gb,
        max_runtime_minutes,
        access_rights,
        command,
        entrypoint,
    )


def create_template_version(
    client: AuthenticatedClient,
    template_id: UUID,
    *,
    description: Optional[str] = None,
    docker_image: Optional[str] = None,
    cpu_cores: Optional[int] = None,
    cpu_memory_gb: Optional[int] = None,
    gpu_memory_gb: Optional[int] = None,
    max_runtime_minutes: Optional[int] = None,
    access_rights: Optional[int] = None,
    command: Optional[str] = None,
    entrypoint: Optional[str] = None,
) -> UUID:
    if docker_image is not None:
        _validate_docker_image(docker_image)

    current = kleinkram.api.routes.get_template(client, str(template_id))

    final_cpu_cores = cpu_cores if cpu_cores is not None else current.cpu_cores
    final_cpu_memory_gb = cpu_memory_gb if cpu_memory_gb is not None else current.cpu_memory_gb
    final_gpu_memory_gb = gpu_memory_gb if gpu_memory_gb is not None else current.gpu_memory_gb
    final_max_runtime_minutes = max_runtime_minutes if max_runtime_minutes is not None else current.max_runtime_minutes

    if final_cpu_cores <= 0 or final_cpu_memory_gb <= 0 or final_gpu_memory_gb < 0 or final_max_runtime_minutes <= 0:
        raise ValueError("Invalid resource limits.")

    return kleinkram.api.routes._create_template_version(
        client,
        template_id,
        name=current.name,
        description=description if description is not None else current.description,
        docker_image=docker_image if docker_image is not None else current.image_name,
        cpu_cores=cpu_cores if cpu_cores is not None else current.cpu_cores,
        cpu_memory_gb=cpu_memory_gb if cpu_memory_gb is not None else current.cpu_memory_gb,
        gpu_memory_gb=gpu_memory_gb if gpu_memory_gb is not None else current.gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes if max_runtime_minutes is not None else current.max_runtime_minutes,
        access_rights=access_rights if access_rights is not None else current.access_rights,
        command=command if command is not None else current.command,
        entrypoint=entrypoint if entrypoint is not None else current.entrypoint,
    )
