from __future__ import annotations

import glob
import os
import queue
from uuid import uuid4
from enum import Enum
import sys
import threading
from typing import Dict, List
from datetime import datetime
from functools import partial
from typing import Generator
from uuid import UUID
from pathlib import Path
import secrets
import string
from typing import NamedTuple

import boto3
import tqdm
import typer
import boto3.s3.transfer
from botocore.config import Config
from botocore.utils import calculate_md5
from kleinkram.api.client import AuthenticatedClient
from rich import print
from rich.console import Console
from typing import Type, Optional, Union
from datetime import datetime

from contextlib import contextmanager

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


def find_or_create_mission(identifier: str, create: bool = False) -> UUID: ...


def find_or_create_project(identifier: str, create: bool = False) -> UUID: ...


def canUploadMission(client: AuthenticatedClient, project_uuid: str):
    # TODO: wtf is happening here
    permissions = client.get("/user/permissions")
    permissions.raise_for_status()
    permissions_json = permissions.json()
    for_project = filter(
        lambda x: x["uuid"] == project_uuid, permissions_json["projects"]
    )
    max_for_project = max(map(lambda x: x["access"], for_project))
    return max_for_project >= 10
