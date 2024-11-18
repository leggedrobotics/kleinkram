from __future__ import annotations

import os
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from time import monotonic
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import Config
from kleinkram.config import LOCAL_S3
from kleinkram.errors import AccessDeniedException
from kleinkram.errors import CorruptedFile
from kleinkram.errors import UploadFailed
from kleinkram.utils import b64_md5
from kleinkram.utils import raw_rich
from rich.text import Text
from tqdm import tqdm

UPLOAD_CREDS = "/file/temporaryAccess"
UPLOAD_CONFIRM = "/queue/confirmUpload"
UPLOAD_CANCEL = "/file/cancelUpload"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/file/download"

S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes


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


def _get_s3_endpoint() -> str:
    config = Config()
    endpoint = config.endpoint

    if "localhost" in endpoint:
        return LOCAL_S3
    else:
        return endpoint.replace("api", "minio")


def _confirm_file_upload(
    client: AuthenticatedClient, file_id: UUID, file_hash: str
) -> None:
    data = {
        "uuid": str(file_id),
        "md5": file_hash,
    }
    resp = client.post(UPLOAD_CONFIRM, json=data)

    if 400 <= resp.status_code < 500:
        raise CorruptedFile()
    resp.raise_for_status()


def _cancel_file_upload(
    client: AuthenticatedClient, file_id: UUID, mission_id: UUID
) -> None:
    data = {
        "uuid": [str(file_id)],
        "missionUUID": str(mission_id),
    }
    resp = client.post(UPLOAD_CANCEL, json=data)
    resp.raise_for_status()
    return


def _get_file_download(client: AuthenticatedClient, id: UUID) -> str:
    """\
    get the download url for a file by file id
    """
    resp = client.get(DOWNLOAD_URL, params={"uuid": str(id), "expires": True})

    if 400 <= resp.status_code < 500:
        raise AccessDeniedException(
            f"Failed to download file: {resp.json()['message']}",
            "Status Code: " + str(resp.status_code),
        )

    resp.raise_for_status()

    return resp.text


def _get_upload_creditials(
    client: AuthenticatedClient, internal_filenames: List[str], mission_id: UUID
) -> Dict[str, UploadCredentials]:
    if mission_id.version != 4:
        raise ValueError("Mission ID must be a UUIDv4")
    dct = {
        "filenames": internal_filenames,
        "missionUUID": str(mission_id),
    }
    resp = client.post(UPLOAD_CREDS, json=dct)

    if resp.status_code >= 400:
        raise ValueError(
            "Failed to get temporary credentials. Status Code: "
            f"{resp.status_code}\n{resp.json()['message'][0]}"
        )

    data = resp.json()

    ret = {}
    for record in data:
        if "error" in record:
            # TODO: handle this better
            continue

        bucket = record["bucket"]
        file_id = UUID(record["fileUUID"], version=4)
        filename = record["fileName"]

        creds = record["accessCredentials"]

        access_key = creds["accessKey"]
        secret_key = creds["secretKey"]
        session_token = creds["sessionToken"]

        ret[filename] = UploadCredentials(
            access_key=access_key,
            secret_key=secret_key,
            session_token=session_token,
            file_id=file_id,
            bucket=bucket,
        )

    return ret


def _s3_upload(
    local_path: Path,
    *,
    endpoint: str,
    credentials: UploadCredentials,
    pbar: tqdm,
) -> bool:
    # configure boto3
    try:
        config = botocore.config.Config(
            retries={"max_attempts": S3_MAX_RETRIES},
            read_timeout=S3_READ_TIMEOUT,
        )
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=credentials.access_key,
            aws_secret_access_key=credentials.secret_key,
            aws_session_token=credentials.session_token,
            config=config,
        )
        client.upload_file(
            str(local_path),
            credentials.bucket,
            str(credentials.file_id),
            Callback=pbar.update,
        )
    except Exception as e:
        err = f"error uploading file: {local_path}: {type(e).__name__}"
        pbar.write(raw_rich(Text(err, style="red")))
        return False
    return True


def _upload_file(
    client: AuthenticatedClient,
    job: FileUploadJob,
    hide_progress: bool = False,
    global_pbar: Optional[tqdm] = None,
) -> Tuple[int, Path]:
    """\
    returns bytes uploaded
    """

    pbar = tqdm(
        total=os.path.getsize(job.path),
        unit="B",
        unit_scale=True,
        desc=f"uploading {job.path.name}...",
        leave=False,
        disable=hide_progress,
    )

    # get creditials for the upload
    try:
        # get upload credentials for a single file
        access = _get_upload_creditials(
            client, internal_filenames=[job.name], mission_id=job.mission_id
        )
        # upload file
        creds = access[job.name]
    except Exception as e:
        pbar.write(f"unable to get upload credentials for file {job.path.name}: {e}")
        pbar.close()
        if global_pbar is not None:
            global_pbar.update()
        return (0, job.path)

    # do the upload
    endpoint = _get_s3_endpoint()
    success = _s3_upload(job.path, endpoint=endpoint, credentials=creds, pbar=pbar)

    if not success:
        try:
            _cancel_file_upload(client, creds.file_id, job.mission_id)
        except Exception as e:
            msg = Text(f"failed to cancel upload: {type(e).__name__}", style="red")
            pbar.write(raw_rich(msg))
    else:
        # tell backend that upload is complete
        try:
            local_hash = b64_md5(job.path)
            _confirm_file_upload(client, creds.file_id, local_hash)

            if global_pbar is not None:
                msg = Text(f"uploaded {job.path}", style="green")
                global_pbar.write(raw_rich(msg))
                global_pbar.update()

        except Exception as e:
            msg = Text(
                f"error confirming upload {job.path}: {type(e).__name__}", style="red"
            )
            pbar.write(raw_rich(msg))

    pbar.close()
    return (job.path.stat().st_size, job.path)


def upload_files(
    files_map: Dict[str, Path],
    mission_id: UUID,
    *,
    verbose: bool = False,
    n_workers: int = 2,
) -> None:
    futures = []

    pbar = tqdm(
        total=len(files_map),
        unit="files",
        desc="Uploading files",
        disable=not verbose,
    )

    start = monotonic()
    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        for name, path in files_map.items():
            # client is not thread safe
            client = AuthenticatedClient()
            job = FileUploadJob(mission_id=mission_id, name=name, path=path)
            future = executor.submit(
                _upload_file,
                client=client,
                job=job,
                hide_progress=not verbose,
                global_pbar=pbar,
            )
            futures.append(future)

    errors = []
    total_size = 0
    for f in futures:
        try:
            size, path = f.result()
            size = size / 1024 / 1024  # convert to MB

            if not verbose and size > 0:
                print(path.absolte())

            total_size += size
        except Exception as e:
            errors.append(e)

    pbar.close()

    time = monotonic() - start
    print(f"upload took {time:.2f} seconds", file=sys.stderr)
    print(f"total size: {int(total_size)} MB", file=sys.stderr)
    print(f"average speed: {total_size / time:.2f} MB/s", file=sys.stderr)

    if errors:
        raise UploadFailed(f"got unhandled errors: {errors} when uploading files")


def _url_download(url: str, path: Path, size: int, overwrite: bool = False) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"File already exists: {path}")

    with httpx.stream("GET", url) as response:
        with open(path, "wb") as f:
            with tqdm(
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
    download_url = _get_file_download(client, file_id)

    file_path = dest / name
    _url_download(download_url, file_path, size)
    observed_hash = b64_md5(file_path)

    if observed_hash != hash:
        raise CorruptedFile("file hash does not match")
