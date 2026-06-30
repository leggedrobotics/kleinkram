from __future__ import annotations

import logging
import re
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from time import monotonic
from time import sleep
from typing import Callable
from typing import Dict
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx

from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_config
from kleinkram.errors import AccessDenied
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import format_traceback
from kleinkram.utils import retry

logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/files/temporaryAccess"
UPLOAD_CONFIRM = "/files/upload/confirm"
UPLOAD_CANCEL = "/files/cancelUpload"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/files/download"

MAX_UPLOAD_RETRIES = 3
S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes

RETRY_BACKOFF_BASE = 2  # exponential backoff base
MAX_RETRIES = 5

# Callback type aliases
OnFileStartCb = Callable[[Path, int], None]  # (path, total_bytes)
OnFileProgressCb = Callable[[Path, int], None]  # (path, advance_bytes)
OnOverallProgressCb = Callable[[], None]
OnMessageCb = Callable[[str, bool], None]  # (message, is_error)


class UploadCredentials(NamedTuple):
    access_key: str
    secret_key: str
    session_token: str
    file_id: UUID
    bucket: str


@retry(max_attempts=3, exceptions=(httpx.HTTPError,))
def _confirm_file_upload(client: AuthenticatedClient, file_id: UUID, file_hash: str) -> None:
    data = {
        "uuid": str(file_id),
        "md5": file_hash,
        "source": "CLI",
    }
    resp = client.post(UPLOAD_CONFIRM, json=data)
    resp.raise_for_status()


@retry(max_attempts=3, exceptions=(httpx.HTTPError,))
def _cancel_file_upload(client: AuthenticatedClient, file_id: UUID, mission_id: UUID) -> None:
    data = {
        "uuids": [str(file_id)],
        "missionUuid": str(mission_id),
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


@retry(max_attempts=5, exceptions=(httpx.HTTPError,), exclude_exceptions=(FileExistsError,))
def _get_upload_creditials(client: AuthenticatedClient, internal_filename: str, mission_id: UUID) -> UploadCredentials:
    dct = {
        "filenames": [internal_filename],
        "missionUUID": str(mission_id),
        "source": "CLI",
    }
    resp = client.post(UPLOAD_CREDS, json=dct)
    if resp.status_code == 409:
        raise FileExistsError()
    resp.raise_for_status()

    data = resp.json()["data"][0]

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
    callback: Optional[Callable[[int], None]] = None,
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
        Callback=callback,
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
    s3_endpoint: Optional[str] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
) -> Tuple[UploadState, int]:
    """
    returns UploadState and bytes uploaded (0 if not uploaded)
    Retries up to 3 times on failure.
    """
    if s3_endpoint is None:
        s3_endpoint = get_config().endpoint.s3

    total_size = path.stat().st_size

    for attempt in range(MAX_UPLOAD_RETRIES):
        if on_file_start_cb is not None:
            on_file_start_cb(path, total_size)

        # get per file upload credentials
        try:
            creds = _get_upload_creditials(client, internal_filename=filename, mission_id=mission_id)
        except FileExistsError:
            return UploadState.EXISTS, 0

        # build the boto3 callback from our file progress callback
        if on_file_progress_cb is not None:

            def boto3_cb(bytes_amount):
                on_file_progress_cb(path, bytes_amount)

        else:
            boto3_cb = None

        try:
            _s3_upload(path, endpoint=s3_endpoint, credentials=creds, callback=boto3_cb)
        except Exception as e:
            logger.error(format_traceback(e))
            try:
                _cancel_file_upload(client, creds.file_id, mission_id)
            except Exception as cancel_e:
                logger.error(f"Failed to cancel upload for {creds.file_id}: {cancel_e}")
                raise RuntimeError(f"Upload failed and cancellation failed for {creds.file_id}: {cancel_e}") from e

            if attempt < 2:  # Retry if not the last attempt
                logger.warning(f"Retrying upload for {path} (attempt {attempt + 1})")
                continue
            else:
                logger.error(f"Cancelling upload for {path} after {attempt + 1} attempts")
                raise e from e

        else:
            _confirm_file_upload(client, creds.file_id, b64_md5(path))
            return UploadState.UPLOADED, total_size


def _get_file_download(client: AuthenticatedClient, id: UUID) -> str:
    """\
    get the download url for a file by file id
    """
    resp = client.get(DOWNLOAD_URL, params={"uuid": str(id), "expires": True, "preview_only": False})

    if 400 <= resp.status_code < 500:
        raise AccessDenied(
            f"Failed to download file: {resp.json()['message']}" f" Status Code: {resp.status_code}",
        )

    resp.raise_for_status()

    return resp.json()["url"]


def _get_filename_from_cd(cd: str | None) -> Optional[str]:
    """Extract filename from Content-Disposition header."""
    if not cd:
        return None
    fname = re.findall("filename=(.+)", cd)
    if len(fname) == 0:
        return None
    return fname[0].strip().strip('"')


def _url_download(
    url: str,
    *,
    path: Path,
    size: int,
    overwrite: bool = False,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
) -> None:
    if path.exists():
        if overwrite:
            path.unlink()
            downloaded = 0
        else:
            downloaded = path.stat().st_size
            if downloaded >= size:
                raise FileExistsError(f"file already exists and is complete: {path}")
    else:
        downloaded = 0

    if on_file_start_cb is not None:
        on_file_start_cb(path, size)

    attempt = 0
    while downloaded < size:
        try:
            headers = {"Range": f"bytes={downloaded}-"}
            with httpx.stream("GET", url, headers=headers, timeout=S3_READ_TIMEOUT) as response:
                # Accept both 206 Partial Content and 200 OK if starting from 0
                if not (response.status_code == 206 or (downloaded == 0 and response.status_code == 200)):
                    response.raise_for_status()
                    raise RuntimeError(f"Expected 206 Partial Content, got {response.status_code}")

                mode = "ab" if downloaded > 0 else "wb"
                with open(path, mode) as f:
                    for chunk in response.iter_bytes(chunk_size=DOWNLOAD_CHUNK_SIZE):
                        attempt = 0  # reset attempt counter on successful download of non-empty chunk
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if on_file_progress_cb is not None:
                            on_file_progress_cb(path, len(chunk))
            break  # download complete
        except Exception as e:
            logger.info(f"Error: {e}, retrying...")
            attempt += 1
            if attempt > MAX_RETRIES:
                raise RuntimeError(f"Download failed after {MAX_RETRIES} retries due to {e}") from e
            logger.warning(f"{e} on attempt {attempt}/{MAX_RETRIES}, retrying after backoff...")
            sleep(RETRY_BACKOFF_BASE**attempt)


class DownloadState(Enum):
    DOWNLOADED_OK = 1
    SKIPPED_OK = 2
    DOWNLOADED_INVALID_HASH = 3
    SKIPPED_INVALID_HASH = 4
    SKIPPED_INVALID_REMOTE_STATE = 5
    SKIPPED_FILE_SIZE_MISMATCH = 6
    SKIPPED_CORRUPTED = 7
    DOWNLOADED_CORRUPTED = 8
    SKIPPED_CORRUPTED_LOCAL_OK = 9
    OVERWRITTEN_OK = 10
    OVERWRITTEN_CORRUPTED = 11


def download_file(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    allow_corrupt_files: bool = False,
    create_parents: bool = False,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
) -> Tuple[DownloadState, int]:
    """\
    Returns DownloadState and bytes downloaded (file.size if successful or skipped ok, 0 otherwise)
    """
    is_corrupted = file.state == FileState.CORRUPTED

    if file.state not in (FileState.OK, FileState.CORRUPTED):
        return DownloadState.SKIPPED_INVALID_REMOTE_STATE, 0

    if is_corrupted and not allow_corrupt_files:
        return DownloadState.SKIPPED_CORRUPTED, 0

    was_overwritten = False
    if path.exists():

        # compare file size
        if file.size == path.stat().st_size:
            local_hash = b64_md5(path)
            if local_hash != file.hash and not overwrite and file.hash is not None:
                return DownloadState.SKIPPED_INVALID_HASH, 0

            elif local_hash == file.hash:
                if is_corrupted:
                    return DownloadState.SKIPPED_CORRUPTED_LOCAL_OK, 0
                return DownloadState.SKIPPED_OK, 0

            elif overwrite:
                was_overwritten = True

        elif not overwrite and file.size is not None:
            return DownloadState.SKIPPED_FILE_SIZE_MISMATCH, 0

        elif overwrite:
            was_overwritten = True

    # request a download url
    download_url = _get_file_download(client, file.id)

    # create parent directories
    if create_parents:
        path.parent.mkdir(parents=True, exist_ok=True)

    # download the file and check the hash
    try:
        _url_download(
            download_url,
            path=path,
            size=file.size,
            overwrite=overwrite,
            on_file_start_cb=on_file_start_cb,
            on_file_progress_cb=on_file_progress_cb,
        )
    except Exception as e:
        logger.error(f"Error during download of {path}: {e}")
        # Attempt to clean up potentially partial file
        if path.exists():
            try:
                path.unlink()
                logger.info(f"Removed potentially incomplete file {path}")
            except OSError as unlink_e:
                logger.error(f"Could not remove partial file {path}: {unlink_e}")
        raise e  # Re-raise to be caught by handler

    observed_hash = b64_md5(path)
    if file.hash is not None and observed_hash != file.hash:
        logger.warning(f"HASH MISMATCH: {path} expected={file.hash} observed={observed_hash}")
        # Download completed but hash failed
        return (
            DownloadState.DOWNLOADED_INVALID_HASH,
            0,
        )  # 0 bytes considered successful transfer
    # Hash matches or no remote hash to check against
    if is_corrupted:
        return DownloadState.OVERWRITTEN_CORRUPTED if was_overwritten else DownloadState.DOWNLOADED_CORRUPTED, file.size
    return DownloadState.OVERWRITTEN_OK if was_overwritten else DownloadState.DOWNLOADED_OK, file.size


@dataclass
class UploadResult:
    uploaded: int = 0
    skipped: int = 0
    failed: int = 0
    total_bytes: int = 0
    elapsed_seconds: float = 0.0


@dataclass
class DownloadResult:
    state_counts: Dict[DownloadState, int] = field(default_factory=dict)
    failed: int = 0
    total_bytes: int = 0
    elapsed_seconds: float = 0.0


def _download_state_message(state: DownloadState, path: Path, file: File) -> Optional[Tuple[str, bool]]:
    """Returns (message, is_error) for a download state, or None if no message."""
    messages: Dict[DownloadState, Tuple[str, bool]] = {
        DownloadState.DOWNLOADED_OK: (f"downloaded {path}", False),
        DownloadState.DOWNLOADED_CORRUPTED: (
            f"downloaded {path} (remote state is CORRUPTED; treat as potentially harmful)",
            True,
        ),
        DownloadState.OVERWRITTEN_OK: (f"overwritten {path}", False),
        DownloadState.OVERWRITTEN_CORRUPTED: (
            f"overwritten {path} (remote state is CORRUPTED; treat as potentially harmful)",
            True,
        ),
        DownloadState.DOWNLOADED_INVALID_HASH: (f"downloaded {path} but failed hash check", True),
        DownloadState.SKIPPED_OK: (f"skipped {path} already downloaded (hash ok)", False),
        DownloadState.SKIPPED_INVALID_HASH: (f"skipped {path}, exists with hash mismatch (use --overwrite?)", False),
        DownloadState.SKIPPED_FILE_SIZE_MISMATCH: (
            f"skipped {path}, exists with file size mismatch (use --overwrite?)",
            False,
        ),
        DownloadState.SKIPPED_INVALID_REMOTE_STATE: (
            f"skipped {path}, remote file has invalid state ({file.state.value})",
            False,
        ),
        DownloadState.SKIPPED_CORRUPTED: (
            f"skipped {path}, remote file is CORRUPTED (use --allow-corrupt to override)",
            False,
        ),
        DownloadState.SKIPPED_CORRUPTED_LOCAL_OK: (
            f"skipped {path}, already present locally (hash ok) but remote file is CORRUPTED; " "treat as potentially harmful",
            True,
        ),
    }
    return messages.get(state)


def upload_files(
    client: AuthenticatedClient,
    files: Dict[str, Path],
    mission_id: UUID,
    *,
    n_workers: int = 2,
    on_overall_progress_cb: Optional[OnOverallProgressCb] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    on_message_cb: Optional[OnMessageCb] = None,
) -> UploadResult:
    start = monotonic()
    futures: Dict[Future[Tuple[UploadState, int]], Path] = {}

    result = UploadResult()

    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        for name, path in files.items():
            if not path.is_file():
                logger.warning(f"Skipping non-existent file: {path}")
                if on_message_cb is not None:
                    on_message_cb(f"Skipping non-existent file: {path}", False)
                result.skipped += 1
                if on_overall_progress_cb is not None:
                    on_overall_progress_cb()
                continue

            future = executor.submit(
                upload_file,
                client=client,
                mission_id=mission_id,
                filename=name,
                path=path,
                on_file_start_cb=on_file_start_cb,
                on_file_progress_cb=on_file_progress_cb,
            )
            futures[future] = path

        for future in as_completed(futures):
            path = futures[future]

            try:
                state, size_bytes = future.result()
            except Exception as e:
                logger.error(format_traceback(e))
                if on_message_cb is not None:
                    on_message_cb(f"Error uploading {path}: {e}", True)
                result.failed += 1
                if on_overall_progress_cb is not None:
                    on_overall_progress_cb()
                continue

            result.total_bytes += size_bytes

            if state == UploadState.UPLOADED:
                result.uploaded += 1
                if on_message_cb is not None:
                    on_message_cb(f"uploaded {path}", False)
            elif state == UploadState.EXISTS:
                result.skipped += 1
                if on_message_cb is not None:
                    on_message_cb(f"skipped {path} (already uploaded)", False)
            else:
                result.failed += 1
                if on_message_cb is not None:
                    on_message_cb(f"canceled {path} upload", True)

            if on_overall_progress_cb is not None:
                on_overall_progress_cb()

    result.elapsed_seconds = monotonic() - start
    return result


def download_files(
    client: AuthenticatedClient,
    files: Dict[Path, File],
    *,
    overwrite: bool = False,
    allow_corrupt_files: bool = False,
    create_parents: bool = False,
    n_workers: int = 2,
    on_overall_progress_cb: Optional[OnOverallProgressCb] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    on_message_cb: Optional[OnMessageCb] = None,
) -> DownloadResult:
    start = monotonic()
    futures: Dict[Future[Tuple[DownloadState, int]], Tuple[File, Path]] = {}
    result = DownloadResult()

    with ThreadPoolExecutor(max_workers=n_workers) as executor:
        for path, file in files.items():
            future = executor.submit(
                download_file,
                client=client,
                file=file,
                path=path,
                overwrite=overwrite,
                allow_corrupt_files=allow_corrupt_files,
                create_parents=create_parents,
                on_file_start_cb=on_file_start_cb,
                on_file_progress_cb=on_file_progress_cb,
            )
            futures[future] = (file, path)

        for future in as_completed(futures):
            file, path = futures[future]

            try:
                state, size_bytes = future.result()
            except Exception as e:
                logger.error(format_traceback(e))
                if on_message_cb is not None:
                    on_message_cb(f"Error downloading {path}: {e}", True)
                result.failed += 1
                if on_overall_progress_cb is not None:
                    on_overall_progress_cb()
                continue

            result.state_counts[state] = result.state_counts.get(state, 0) + 1

            if state in (
                DownloadState.DOWNLOADED_OK,
                DownloadState.DOWNLOADED_CORRUPTED,
                DownloadState.SKIPPED_OK,
                DownloadState.OVERWRITTEN_OK,
                DownloadState.OVERWRITTEN_CORRUPTED,
            ):
                result.total_bytes += size_bytes

            # Generate per-file status messages
            if on_message_cb is not None:
                msg = _download_state_message(state, path, file)
                if msg is not None:
                    on_message_cb(*msg)

            if on_overall_progress_cb is not None:
                on_overall_progress_cb()

    result.elapsed_seconds = monotonic() - start
    return result
