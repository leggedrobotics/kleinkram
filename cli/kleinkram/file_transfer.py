from __future__ import annotations

import os
import queue
import sys
import threading
from time import monotonic
from contextlib import contextmanager
from functools import partial
from pathlib import Path
from typing import Dict, List
from typing import Generator
from typing import NamedTuple
from typing import Optional
from typing import Union
from uuid import UUID
from concurrent.futures import ThreadPoolExecutor

import boto3.s3.transfer
import botocore.config
import httpx
import tqdm
from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import confirm_file_upload
from kleinkram.api.routes import (
    get_file_download,
    get_upload_creditials,
    cancel_file_upload,
)
from kleinkram.api.routes import get_file
from kleinkram.config import Config
from kleinkram.consts import LOCAL_API_URL
from kleinkram.consts import LOCAL_S3_URL
from kleinkram.errors import CorruptedFile
from kleinkram.utils import b64_md5

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16  # 16MB


class FailedUpload(Exception): ...


class UploadCredentials(NamedTuple):
    access_key: str
    secret_key: str
    session_token: str
    file_id: UUID
    bucket: str


class FileUploadJob(NamedTuple):
    mission_id: UUID
    name: str
    path: Path


class ProgressManager:
    _lock: threading.Lock  # TODO: we probably dont need a lock
    _file_progress: Dict[Union[str, UUID], tqdm.tqdm]  # pbar, transferred bytes

    def __init__(self):
        self._lock = threading.Lock()
        self._file_progress = {}

    def add(self, file: UUID, target_size: int):
        with self._lock:
            pbar = tqdm.tqdm(
                total=target_size,
                unit="B",
                unit_scale=True,
                desc=f"Uploading {file}",
                leave=False,
            )

            if file in self._file_progress:
                raise ValueError(f"file {file} already tracked")

            self._file_progress[file] = pbar

    def remove(self, file: UUID) -> None:
        with self._lock:
            pbar = self._file_progress.pop(file)
            pbar.close()

    def update(self, file: UUID, bytes_transferred: int):
        with self._lock:
            if file in self._file_progress:
                pbar = self._file_progress[file]
                pbar.update(bytes_transferred)

    def write(self, file: UUID, msg: str):
        with self._lock:
            if file in self._file_progress:
                pbar = self._file_progress[file]
                pbar.write(msg)

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


def get_s3_endpoint() -> str:
    config = Config()
    api_endpoint = config.endpoint
    if api_endpoint == LOCAL_API_URL:
        return LOCAL_S3_URL
    else:
        return api_endpoint.replace("api", "minio")


def _s3_upload(
    local_path: Path,
    endpoint: str,
    credentials: UploadCredentials,
    progress: tqdm.tqdm,
) -> None:
    # configure boto3
    sess = boto3.Session(
        aws_access_key_id=credentials.access_key,
        aws_secret_access_key=credentials.secret_key,
        aws_session_token=credentials.session_token,
    )
    boto_config = botocore.config.Config(
        retries={"max_attempts": 10, "mode": "standard"}
    )
    transfer_config = boto3.s3.transfer.TransferConfig(
        multipart_chunksize=10 * 1024 * 1024,
        max_concurrency=5,
    )

    # upload file
    s3_resource = sess.resource("s3", endpoint_url=endpoint, config=boto_config)
    s3_resource.Bucket(credentials.bucket).upload_file(
        local_path,
        str(credentials.file_id),
        Config=transfer_config,
        Callback=progress.update,
    )


def _upload_file(
    client: AuthenticatedClient,
    job: FileUploadJob,
    hide_progress: bool = False,
) -> int:
    """\
    returns bytes uploaded
    """

    pbar = tqdm.tqdm(
        total=os.path.getsize(job.path),
        unit="B",
        unit_scale=True,
        desc=f"uploading {job.path.name}...",
        leave=False,
        disable=hide_progress,
    )

    # get upload credentials for a single file
    access = get_upload_creditials(
        client, internal_filenames=[job.name], mission_id=job.mission_id
    )
    # upload file
    creds = access.get(job.name)

    if creds is None:
        pbar.write(f"file {job.name} already exists in mission")
        pbar.close()
        return 0

    try:
        _s3_upload(job.path, get_s3_endpoint(), creds, pbar)
    except Exception as e:
        pbar.write(f"error uploading file: {job.path}: {e}")
        cancel_file_upload(client, creds.file_id, job.mission_id)
    else:
        # tell backend that upload is complete
        local_hash = b64_md5(job.path)
        confirm_file_upload(client, creds.file_id, local_hash)
    finally:
        pbar.close()
        return job.path.stat().st_size


def upload_files(
    files_map: Dict[str, Path],
    mission_id: UUID,
    *,
    n_workers: int = 8,
) -> None:
    futures = []

    start = monotonic()
    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        for name, path in files_map.items():
            # client is not thread safe
            client = AuthenticatedClient()
            job = FileUploadJob(mission_id=mission_id, name=name, path=path)
            future = executor.submit(_upload_file, client=client, job=job)
            futures.append(future)

    errors = []
    total_size = 0
    for f in futures:
        try:
            total_size += f.result() / 1e6
        except Exception as e:
            errors.append(e)

    time = monotonic() - start
    print(f"upload took {time:.2f} seconds")
    print(f"total size: {int(total_size)} MB")
    print(f"average speed: {total_size / time:.2f} MB/s")

    if errors:
        raise FailedUpload(f"got unhandled errors: {errors} when uploading files")


def _url_download(url: str, path: Path, size: int, overwrite: bool = False) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"File already exists: {path}")

    with httpx.stream("GET", url) as response:
        with open(path, "wb") as f:
            with tqdm.tqdm(
                total=size, desc=f"Downloading {path.name}", unit="B", unit_scale=True
            ) as pbar:
                for chunk in response.iter_bytes(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    f.write(chunk)
                    pbar.update(len(chunk))


def download_file(
    client: AuthenticatedClient,
    file_id: UUID,
    name: str,
    dest: Path,
    hash: str,
    size: int,
) -> None:
    download_url = get_file_download(client, file_id)

    file_path = dest / name
    _url_download(download_url, file_path, size)
    observed_hash = b64_md5(file_path)

    if observed_hash != hash:
        raise CorruptedFile
