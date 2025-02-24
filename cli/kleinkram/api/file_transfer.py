from __future__ import annotations

import logging
import sys
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from enum import Enum
from pathlib import Path
from time import monotonic
from typing import Dict
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
from rich.console import Console
from tqdm import tqdm

from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_config
from kleinkram.errors import AccessDenied
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import format_error
from kleinkram.utils import format_traceback
from kleinkram.utils import styled_string

logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/files/temporaryAccess"
UPLOAD_CONFIRM = "/queue/confirmUpload"
UPLOAD_CANCEL = "/files/cancelUpload"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/files/download"

S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes


class UploadCredentials(NamedTuple):
    access_key: str
    secret_key: str
    session_token: str
    file_id: UUID
    bucket: str


def _confirm_file_upload(
    client: AuthenticatedClient, file_id: UUID, file_hash: str
) -> None:
    data = {
        "uuid": str(file_id),
        "md5": file_hash,
    }
    resp = client.post(UPLOAD_CONFIRM, json=data)
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


FILE_EXISTS_ERROR = "File already exists"

# fields for upload credentials
ACCESS_KEY_FIELD = "accessKey"
SECRET_KEY_FIELD = "secretKey"
SESSION_TOKEN_FIELD = "sessionToken"
CREDENTIALS_FIELD = "accessCredentials"
FILE_ID_FIELD = "fileUUID"
BUCKET_FIELD = "bucket"


def _get_upload_creditials(
    client: AuthenticatedClient, internal_filename: str, mission_id: UUID
) -> Optional[UploadCredentials]:
    dct = {
        "filenames": [internal_filename],
        "missionUUID": str(mission_id),
    }
    resp = client.post(UPLOAD_CREDS, json=dct)
    resp.raise_for_status()

    data = resp.json()["data"][0]

    if data.get("error") == FILE_EXISTS_ERROR:
        return None

    bucket = data[BUCKET_FIELD]
    file_id = UUID(data[FILE_ID_FIELD], version=4)

    creds = data[CREDENTIALS_FIELD]
    access_key = creds[ACCESS_KEY_FIELD]
    secret_key = creds[SECRET_KEY_FIELD]
    session_token = creds[SESSION_TOKEN_FIELD]

    return UploadCredentials(
        access_key=access_key,
        secret_key=secret_key,
        session_token=session_token,
        file_id=file_id,
        bucket=bucket,
    )


def _s3_upload(
    local_path: Path,
    *,
    endpoint: str,
    credentials: UploadCredentials,
    pbar: tqdm,
) -> None:
    # configure boto3
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


class UploadState(Enum):
    UPLOADED = 1
    EXISTS = 2
    CANCELED = 3


# TODO: i dont want to handle errors at this level
def upload_file(
    client: AuthenticatedClient,
    *,
    mission_id: UUID,
    filename: str,
    path: Path,
    verbose: bool = False,
    s3_endpoint: Optional[str] = None,
) -> UploadState:
    """\
    returns bytes uploaded
    """
    if s3_endpoint is None:
        s3_endpoint = get_config().endpoint.s3

    total_size = path.stat().st_size
    with tqdm(
        total=total_size,
        unit="B",
        unit_scale=True,
        desc=f"uploading {path}...",
        leave=False,
        disable=not verbose,
    ) as pbar:
        # get per file upload credentials
        creds = _get_upload_creditials(
            client, internal_filename=filename, mission_id=mission_id
        )
        if creds is None:
            return UploadState.EXISTS

        try:
            _s3_upload(path, endpoint=s3_endpoint, credentials=creds, pbar=pbar)
        except Exception as e:
            logger.error(format_traceback(e))
            _cancel_file_upload(client, creds.file_id, mission_id)
            return UploadState.CANCELED
        else:
            _confirm_file_upload(client, creds.file_id, b64_md5(path))
            return UploadState.UPLOADED


def _get_file_download(client: AuthenticatedClient, id: UUID) -> str:
    """\
    get the download url for a file by file id
    """
    resp = client.get(DOWNLOAD_URL, params={"uuid": str(id), "expires": True})

    if 400 <= resp.status_code < 500:
        raise AccessDenied(
            f"Failed to download file: {resp.json()['message']}"
            f"Status Code: {resp.status_code}",
        )

    resp.raise_for_status()

    return resp.text


def _url_download(
    url: str, *, path: Path, size: int, overwrite: bool = False, verbose: bool = False
) -> None:
    if path.exists() and not overwrite:
        raise FileExistsError(f"file already exists: {path}")

    with httpx.stream("GET", url) as response:
        with open(path, "wb") as f:
            with tqdm(
                total=size,
                desc=f"downloading {path.name}",
                unit="B",
                unit_scale=True,
                leave=False,
                disable=not verbose,
            ) as pbar:
                for chunk in response.iter_bytes(chunk_size=DOWNLOAD_CHUNK_SIZE):
                    f.write(chunk)
                    pbar.update(len(chunk))


class DownloadState(Enum):
    DOWNLOADED_OK = 1
    SKIPPED_OK = 2
    DOWNLOADED_INVALID_HASH = 3
    SKIPPED_INVALID_HASH = 4
    SKIPPED_INVALID_REMOTE_STATE = 5


def download_file(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    verbose: bool = False,
) -> DownloadState:
    # skip files that are not ok on remote
    if file.state != FileState.OK:
        return DownloadState.SKIPPED_INVALID_REMOTE_STATE

    # skip existing files depending on flags set
    if path.exists():
        local_hash = b64_md5(path)
        if local_hash != file.hash and not overwrite and file.hash is not None:
            return DownloadState.SKIPPED_INVALID_HASH

        elif local_hash == file.hash:
            return DownloadState.SKIPPED_OK

        # this has to be here
        if verbose:
            tqdm.write(
                styled_string(f"overwriting {path}, hash missmatch", style="yellow")
            )

    # request a download url
    download_url = _get_file_download(client, file.id)

    # create parent directories
    path.parent.mkdir(parents=True, exist_ok=True)

    # download the file and check the hash
    _url_download(
        download_url, path=path, size=file.size, overwrite=overwrite, verbose=verbose
    )
    observed_hash = b64_md5(path)
    if file.hash is not None and observed_hash != file.hash:
        return DownloadState.DOWNLOADED_INVALID_HASH
    return DownloadState.DOWNLOADED_OK


UPLOAD_STATE_COLOR = {
    UploadState.UPLOADED: "green",
    UploadState.EXISTS: "yellow",
    UploadState.CANCELED: "red",
}


def _upload_handler(
    future: Future[UploadState], path: Path, *, verbose: bool = False
) -> int:
    try:
        state = future.result()
    except Exception as e:
        logger.error(format_traceback(e))
        if verbose:
            tqdm.write(format_error(f"error uploading {path}", e))
        else:
            print(path.absolute(), file=sys.stderr)
        return 0

    if state == UploadState.UPLOADED:
        msg = f"uploaded {path}"
    elif state == UploadState.EXISTS:
        msg = f"skipped {path} already uploaded"
    else:
        msg = f"canceled {path} upload"

    if verbose:
        tqdm.write(styled_string(msg, style=UPLOAD_STATE_COLOR[state]))
    else:
        stream = sys.stdout if state == UploadState.UPLOADED else sys.stderr
        print(path.absolute(), file=stream)

    return path.stat().st_size if state == UploadState.UPLOADED else 0


DOWNLOAD_STATE_COLOR = {
    DownloadState.DOWNLOADED_OK: "green",
    DownloadState.SKIPPED_OK: "green",
    DownloadState.DOWNLOADED_INVALID_HASH: "red",
    DownloadState.SKIPPED_INVALID_HASH: "yellow",
    DownloadState.SKIPPED_INVALID_REMOTE_STATE: "purple",
}


def _download_handler(
    future: Future[DownloadState], file: File, path: Path, *, verbose: bool = False
) -> int:
    try:
        state = future.result()
    except Exception as e:
        logger.error(format_traceback(e))
        if verbose:
            tqdm.write(format_error(f"error uploading {path}", e))
        else:
            print(path.absolute(), file=sys.stderr)
        return 0

    if state == DownloadState.DOWNLOADED_OK:
        msg = f"downloaded {path}"
    elif state == DownloadState.DOWNLOADED_INVALID_HASH:
        msg = f"downloaded {path} failed hash check"
    elif state == DownloadState.SKIPPED_OK:
        msg = f"skipped {path} already downloaded"
    elif state == DownloadState.SKIPPED_INVALID_HASH:
        msg = f"skipped {path} already downloaded, hash missmatch, cosider using `--overwrite`"
    else:
        msg = f"skipped {path} remote file has invalid state"

    if verbose:
        tqdm.write(styled_string(msg, style=DOWNLOAD_STATE_COLOR[state]))
    else:
        stream = (
            sys.stdout
            if state in (DownloadState.DOWNLOADED_OK, DownloadState.SKIPPED_OK)
            else sys.stderr
        )
        print(path.absolute(), file=stream)

    # number of bytes downloaded
    return file.size if state == DownloadState.DOWNLOADED_OK else 0


def upload_files(
    client: AuthenticatedClient,
    files: Dict[str, Path],
    mission_id: UUID,
    *,
    verbose: bool = False,
    n_workers: int = 2,
) -> None:
    with tqdm(
        total=len(files),
        unit="files",
        desc="uploading files",
        disable=not verbose,
        leave=False,
    ) as pbar:
        start = monotonic()
        futures: Dict[Future[UploadState], Path] = {}
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for name, path in files.items():
                future = executor.submit(
                    upload_file,
                    client=client,
                    mission_id=mission_id,
                    filename=name,
                    path=path,
                    verbose=verbose,
                )
                futures[future] = path

            total_size = 0
            for future in as_completed(futures):
                size = _upload_handler(future, futures[future], verbose=verbose)
                total_size += size / 1024 / 1024

                pbar.update()
            pbar.refresh()

        t = monotonic() - start
        c = Console(file=sys.stderr)
        c.print(f"upload took {t:.2f} seconds")
        c.print(f"total size: {int(total_size)} MB")
        c.print(f"average speed: {total_size / t:.2f} MB/s")


def download_files(
    client: AuthenticatedClient,
    files: Dict[Path, File],
    *,
    verbose: bool = False,
    overwrite: bool = False,
    n_workers: int = 2,
) -> None:
    with tqdm(
        total=len(files),
        unit="files",
        desc="downloading files",
        disable=not verbose,
        leave=False,
    ) as pbar:

        start = monotonic()
        futures: Dict[Future[DownloadState], Tuple[File, Path]] = {}
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for path, file in files.items():
                future = executor.submit(
                    download_file,
                    client=client,
                    file=file,
                    path=path,
                    overwrite=overwrite,
                    verbose=verbose,
                )
                futures[future] = (file, path)

            total_size = 0
            for future in as_completed(futures):
                file, path = futures[future]
                size = _download_handler(future, file, path, verbose=verbose)
                total_size += size / 1024 / 1024  # MB
                pbar.update()
            pbar.refresh()

        time = monotonic() - start
        c = Console(file=sys.stderr)
        c.print(f"download took {time:.2f} seconds")
        c.print(f"total size: {int(total_size)} MB")
        c.print(f"average speed: {total_size  / time:.2f} MB/s")
