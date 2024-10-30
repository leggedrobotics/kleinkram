from __future__ import annotations

from kleinkram.utils import ProgressManager, transfer_progress

import boto3
import botocore.config
import boto3.s3.transfer

from typing import Dict, NamedTuple, Optional
from uuid import UUID
from pathlib import Path
from functools import partial

import os

from kleinkram.api.client import AuthenticatedClient



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
