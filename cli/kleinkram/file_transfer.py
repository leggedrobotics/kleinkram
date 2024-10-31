from __future__ import annotations

import os
import queue
import threading
from functools import partial
from pathlib import Path
from typing import Dict
from typing import NamedTuple
from typing import Optional
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
import tqdm
import sys
from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.consts import LOCAL_API_URL
from kleinkram.consts import LOCAL_S3_URL
from kleinkram.utils import ProgressManager
from kleinkram.utils import transfer_progress

DOWNLOAD_CHUNK_SIZE = 1024 * 128


def get_s3_endpoint() -> str:
    # TODO: this needs to be more configurable
    api_endpoint = AuthenticatedClient().tokenfile.endpoint
    if api_endpoint == LOCAL_API_URL:
        return LOCAL_S3_URL
    else:
        return api_endpoint.replace("api", "minio")


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

    boto_config = botocore.config.Config(
        retries={"max_attempts": 10, "mode": "standard"}
    )
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


def upload_files(
    file_access: Dict[Path, UploadAccess],
    internal_filename_map: Dict[Path, str],
    *,
    n_workers: int = 8,
):
    # get proper s3_endpoint
    s3_endpoint = get_s3_endpoint()
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
                args=(file_queue, s3_endpoint, callback),
            )
            thread.start()
            thread_pool.append(thread)

        # wait for all threads
        for thread in thread_pool:
            thread.join()


def download_file(url: str, path: Path) -> None:
    if path.exists():
        raise FileExistsError(f"File already exists: {path}")

    with httpx.stream("GET", url) as response:
        with open(path, "wb") as f:
            for chunk in tqdm.tqdm(
                response.iter_bytes(chunk_size=DOWNLOAD_CHUNK_SIZE),
                desc=f"Downloading {path.name}",
                unit="B",
                unit_scale=True,
            ):
                for chunk in response.iter_bytes():
                    f.write(chunk)
