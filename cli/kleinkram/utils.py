from __future__ import annotations

import glob
import os
import queue
import secrets
import string
import sys
import threading
from contextlib import contextmanager
from datetime import datetime
from enum import Enum
from functools import partial
from pathlib import Path
from typing import cast
from typing import Dict
from typing import Generator
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Type
from typing import Union
from uuid import UUID
from uuid import uuid4

import boto3.s3.transfer
import tqdm
import typer
from botocore.config import Config
from rich import print
from rich.console import Console
import hashlib
import base64

from kleinkram.api.client import AuthenticatedClient
from kleinkram.enums import PermissionLevel

INTERNAL_ALLOWED_CHARS = string.ascii_letters + string.digits + "_" + "-"


def matched_paths(pattern: str) -> Generator[Path, None, None]:
    """\
    yields path to files matching a glob pattern
    expanding user and environment variables
    """
    expanded = os.path.expandvars(os.path.expanduser(pattern))
    yield from map(Path, glob.iglob(expanded, recursive=True))


def is_valid_uuid4(uuid: str) -> bool:
    try:
        UUID(uuid, version=4)
        return True
    except ValueError:
        return False


def get_internal_file_map(files: List[Path]) -> Dict[Path, str]:
    """\
    takes a list of unique filepaths and returns a mapping
    from the original filename to a sanitized internal filename

    the format for this internal filename is:
    - replace all disallowed characters with "_"
    - trim to 40 chars + 10 random chars

    allowed chars are:
    - ascii letters (upper and lower case)
    - digits
    - "_" and "-"
    """
    internal_file_map = {}

    for file in files:
        if file.is_dir():
            raise ValueError(f"got dir {file} expected file")

        # replace all disallowed characters with "_" and trim to 40 chars + 10 random chars
        allowed_stem = "".join(
            char if char in INTERNAL_ALLOWED_CHARS else "_" for char in file.stem
        )
        trimmed_stem = f"{allowed_stem[:40]}{secrets.token_urlsafe(10)}"
        internal_file_map[file] = f"{trimmed_stem}{file.suffix}"

    if len(internal_file_map) != len(files):
        raise ValueError("files must be unique")

    # this should never happend since our random token has 64**10 possibilities
    if len(internal_file_map) != len(set(internal_file_map.values())):
        internal_file_map = get_internal_file_map(files)  # universe heat death

    return internal_file_map


class ProgressManager:
    _lock: threading.Lock  # TODO: we probably dont need a lock
    _file_progress: Dict[Union[str, UUID], tqdm.tqdm]  # pbar, transferred bytes

    def __init__(self):
        self._lock = threading.Lock()
        self._file_progress = {}

    def track_file(self, file: Union[UUID, str], target_size: int):
        with self._lock:
            pbar = tqdm.tqdm(
                total=target_size,
                unit="B",
                unit_scale=True,
                desc=f"Uploading {file}",
            )

            if file in self._file_progress:
                raise ValueError(f"file {file} already tracked")

            self._file_progress[file] = pbar

    def update(self, file: Union[UUID, str], bytes_transferred: int):
        with self._lock:
            if file in self._file_progress:
                pbar = self._file_progress[file]
                pbar.update(bytes_transferred)

    def close(self):
        with self._lock:
            for pbar in self._file_progress.values():
                pbar.close()


@contextmanager
def transfer_progress() -> Generator[ProgressManager, None, None]:
    """\
    context manager to provide a TransferProgressCallback instance
    """

    transfer_callback = ProgressManager()

    try:
        yield transfer_callback
    finally:
        transfer_callback.close()


class UploadAccess(NamedTuple):
    access_key: str
    secret_key: str
    session_token: str
    file_id: UUID
    bucket: str


class FileUploadJob(NamedTuple):
    local_path: Path
    internal_filename: str
    access: UploadAccess
    error: Optional[str] = None


def upload_files(
    file_access: dict[Path, UploadAccess],
    internal_filename_map: dict[Path, str],
    *,
    n_workers: int = 8,
):
    client = AuthenticatedClient()

    # TODO: what is happening here?
    api_endpoint = client.tokenfile.endpoint
    if api_endpoint == "http://localhost:3000":
        minio_endpoint = "http://localhost:9000"
    else:
        minio_endpoint = api_endpoint.replace("api", "minio")

    file_queue = queue.Queue()

    for path, access in file_access.items():
        job = FileUploadJob(
            local_path=path,
            internal_filename=internal_filename_map[path],
            access=access,
        )
        file_queue.put(job)

    # TODO: use ThreadPoolExecutor
    thread_pool = []
    with transfer_progress() as callback:
        for _ in range(n_workers):
            thread = threading.Thread(
                target=file_upload_worker,
                args=(file_queue, minio_endpoint, callback),
            )
            thread.start()
            thread_pool.append(thread)

        # wait for all threads
        for thread in thread_pool:
            thread.join()


def upload_file(
    local_path: Path,
    endpoint: str,
    access: UploadAccess,
    progress: ProgressManager,
) -> None:
    sess = boto3.Session(
        aws_access_key_id=access.access_key,
        aws_secret_access_key=access.secret_key,
        aws_session_token=access.session_token,
    )

    boto_config = Config(retries={"max_attempts": 10, "mode": "standard"})
    transfer_config = boto3.s3.transfer.TransferConfig(
        multipart_chunksize=10 * 1024 * 1024,
        max_concurrency=5,
    )

    # TODO: checksum
    file_size = os.path.getsize(local_path)
    progress.track_file(str(local_path), file_size)

    callback_fn = partial(progress.update, str(local_path))

    s3_resource = sess.resource("s3", endpoint_url=endpoint, config=boto_config)
    s3_resource.Bucket(access.bucket).upload_file(
        local_path,
        str(access.file_id),
        Config=transfer_config,
        Callback=callback_fn,
    )


def file_upload_worker(
    file_queue: queue.Queue[FileUploadJob],
    enpoint: str,
    progress: ProgressManager,
) -> None:

    while True:
        try:
            job = file_queue.get()

            if job.error is not None:
                console = Console(file=sys.stderr, style="red", highlight=False)
                console.print(f"Error uploading file: {job.local_path}: {job.error}")
                file_queue.task_done()
                continue

            upload_file(
                local_path=job.local_path,
                endpoint=enpoint,
                access=job.access,
                progress=progress,
            )

        except queue.Empty:
            break
        except Exception as e:
            print(e)
            file_queue.task_done()

    return None


PROJECT_BY_NAME = "project/byName"
PROJECT_BY_ID = "project/one"
PROJECT_CREATE = "project/create"

MISSION_BY_NAME = "mission/byName"
MISSION_BY_ID = "mission/one"
MISSION_CREATE = "mission/create"


def get_project(
    client: AuthenticatedClient, identifier: Union[str, UUID]
) -> Optional[UUID]:

    if isinstance(identifier, UUID):
        params = {"uuid": str(identifier)}
    else:
        params = {"name": identifier}

    resp = client.get("/missions", params=params)

    if resp.status_code in (403, 404):
        return None

    # TODO: handle other status codes
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def create_project(
    client: AuthenticatedClient,
    project_name: str,
    *,
    check_exists: bool = False,
) -> UUID:
    """\
    creates a new mission with the given name and project_id

    if check_exists is True, the function will return the existing mission_id,
    otherwise if the mission already exists an error will be raised
    """

    if check_exists:
        project_id = get_mission(client, project_name)
        if project_id is not None:
            return project_id

    if is_valid_uuid4(project_name):
        raise ValueError(
            f"Project name: `{project_name}` is a valid UUIDv4, "
            "project names must not be valid UUIDv4's"
        )

    resp = client.post(
        MISSION_CREATE,
        json={
            "name": project_name,
            "description": "Autogenerated by klein CLI",
            "requiredTags": [],
        },
    )

    if resp.status_code >= 400:
        raise ValueError(
            f"Failed to create project. Status Code: "
            f"{str(resp.status_code)}\n"
            f"{resp.json()['message'][0]}"
        )

    return UUID(resp.json()["uuid"], version=4)


def get_mission(
    client: AuthenticatedClient, identifier: Union[str, UUID], project_id: UUID
) -> Optional[UUID]:

    if isinstance(identifier, UUID):
        params = {"uuid": str(identifier)}
    else:
        # ISSUE: https://github.com/leggedrobotics/kleinkram/issues/851
        params = {"name": identifier, "projectUUID": str(project_id)}

    resp = client.get("/missions", params=params)

    if resp.status_code in (403, 404):
        return None

    # TODO: handle other status codes
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def create_mission(
    client: AuthenticatedClient,
    project_id: UUID,
    mission_name: str,
    *,
    check_exists: bool = False,
) -> UUID:
    """\
    creates a new mission with the given name and project_id

    if check_exists is True, the function will return the existing mission_id,
    otherwise if the mission already exists an error will be raised
    """

    if check_exists:
        mission_id = get_mission(client, mission_name, project_id)
        if mission_id is not None:
            return mission_id

    if is_valid_uuid4(mission_name):
        raise ValueError(
            f"Mission name: `{mission_name}` is a valid UUIDv4, "
            "mission names must not be valid UUIDv4's"
        )

    resp = client.post(
        MISSION_CREATE,
        json={
            "name": mission_name,
            "description": "Autogenerated by klein CLI",
            "requiredTags": [],
            "project_uuid": str(project_id),
        },
    )

    if resp.status_code >= 400:
        raise ValueError(
            f"Failed to create mission. Status Code: "
            f"{str(resp.status_code)}\n"
            f"{resp.json()['message'][0]}"
        )

    return UUID(resp.json()["uuid"], version=4)


def get_project_permission_level(client: AuthenticatedClient, project_id: UUID) -> int:
    """\
    we need this to check if a user has the permissions to
    create a mission in an existing project
    """

    resp = client.get("/user/permissions")
    resp.raise_for_status()

    project_group: list[dict[str, str | int]] = resp.json().get("projects", [])
    filtered_by_id = filter(lambda x: x.get("uuid") == str(project_id), project_group)

    # it is possilbe that a user has access to a project via multiple groups
    # in this case we take the highest permission level
    return cast(int, max(map(lambda x: x.get("access", 0), filtered_by_id)))


def get_version() -> str:
    # TODO
    return "0.1.0"


def b64_md5(file: Path) -> str:
    hash_md5 = hashlib.md5()
    with open(file, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    binary_digest = hash_md5.digest()
    return base64.b64encode(binary_digest).decode("utf-8")
