from __future__ import annotations

import logging
import re
import threading
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from concurrent.futures import wait
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from time import monotonic
from typing import Callable
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Set
from typing import Tuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
from botocore.exceptions import ClientError

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.mcap_filter import filter_mcap_from_url
from kleinkram.api.mcap_filter import is_mcap
from kleinkram.api.retry import Retrier
from kleinkram.api.retry import RetryPolicy
from kleinkram.api.retry import describe_error
from kleinkram.api.retry import is_unsent
from kleinkram.api.retry import retrying
from kleinkram.config import get_config
from kleinkram.errors import AccessDenied
from kleinkram.errors import InsufficientStorageError
from kleinkram.errors import TransferCancelledError
from kleinkram.errors import transfer_interrupted
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import format_traceback

logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/files/temporaryAccess"
UPLOAD_CONFIRM = "/files/upload/confirm"
UPLOAD_CANCEL = "/files/uploads"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/files/{}/download"

S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes

# Requests to the Kleinkram API that are safe to repeat.
API_RETRY = RetryPolicy(max_attempts=3)
# Downloads resume where they stopped.
DOWNLOAD_RETRY = RetryPolicy(max_attempts=6)


# Only unsent requests: the request reserves the file name, so a resend the
# server already handled gets 409 and is reported as "already uploaded".
UPLOAD_CREDENTIALS_RETRY = RetryPolicy(max_attempts=5, retry_on=is_unsent)


def _is_worth_restarting_upload(e: BaseException) -> bool:
    """Whether to start an upload again, with fresh credentials, after boto3 gave up.

    boto3 already retries network and server errors itself (`S3_MAX_RETRIES`),
    so this sees what is left: mostly problems a new attempt with new
    credentials can fix (they expired during a very long upload, the storage
    backend restarted). That is why this lists what *not* to restart rather
    than what to restart: the local file cannot be read, which fails the same
    way every time.
    """
    return not isinstance(e, (FileNotFoundError, PermissionError, IsADirectoryError))


# Each restart sits on top of boto3's own retries, so keep the count low.
UPLOAD_RESTART_RETRY = RetryPolicy(max_attempts=3, retry_on=_is_worth_restarting_upload)

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


@retrying(API_RETRY)
def _confirm_file_upload(client: AuthenticatedClient, file_id: UUID, file_hash: str) -> None:
    data = {
        "uuid": str(file_id),
        "md5": file_hash,
        "source": "CLI",
    }
    resp = client.post(UPLOAD_CONFIRM, json=data)
    resp.raise_for_status()


@retrying(API_RETRY)
def _cancel_file_upload(client: AuthenticatedClient, file_id: UUID, mission_id: UUID) -> None:
    data = {
        "uuids": [str(file_id)],
        "missionUuid": str(mission_id),
    }
    resp = client.delete(UPLOAD_CANCEL, json=data)
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


@retrying(UPLOAD_CREDENTIALS_RETRY)
def _get_upload_creditials(
    client: AuthenticatedClient, internal_filename: str, mission_id: UUID, file_size: int
) -> UploadCredentials:
    dct = {
        "filenames": [internal_filename],
        "missionUUID": str(mission_id),
        "source": "CLI",
        "fileSizes": [file_size],
    }
    resp = client.post(UPLOAD_CREDS, json=dct)
    if resp.status_code == 409:
        raise FileExistsError()
    if resp.status_code == 507:
        raise InsufficientStorageError("Insufficient storage space on the server")
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


def _is_s3_out_of_space_error(e: Exception) -> bool:
    if isinstance(e, ClientError):
        response = e.response
        error = response.get("Error", {})
        code = error.get("Code", "")
        message = error.get("Message", "")
        status_code = response.get("ResponseMetadata", {}).get("HTTPStatusCode", 0)

        if status_code == 507:
            return True

        out_of_space_codes = {
            "InsufficientStorageSpace",
            "QuotaExceeded",
            "StorageLimitExceeded",
            "QuotaExceededException",
        }
        if code in out_of_space_codes:
            return True

        message_lower = message.lower()
        if "insufficient storage" in message_lower or "out of space" in message_lower or "no space left" in message_lower:
            return True

    e_str = str(e).lower()
    if (
        "insufficient storage" in e_str
        or "out of space" in e_str
        or "no space left" in e_str
        or "507 insufficient storage" in e_str
    ):
        return True

    return False


class UploadState(Enum):
    UPLOADED = 1
    EXISTS = 2
    CANCELED = 3


def upload_file(
    client: AuthenticatedClient,
    *,
    mission_id: UUID,
    filename: str,
    path: Path,
    s3_endpoint: Optional[str] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    cancel_event: Optional[threading.Event] = None,
) -> Tuple[UploadState, int]:
    """
    returns UploadState and bytes uploaded (0 if not uploaded)
    Starts again with fresh credentials when boto3 gives up (`UPLOAD_RESTART_RETRY`).
    """
    if s3_endpoint is None:
        s3_endpoint = get_config().endpoint.s3

    total_size = path.stat().st_size

    retrier = Retrier(UPLOAD_RESTART_RETRY, cancel_event=cancel_event, name=f"upload of {path.name}")
    while True:
        if cancel_event is not None and cancel_event.is_set():
            return UploadState.CANCELED, 0

        if on_file_start_cb is not None:
            on_file_start_cb(path, total_size)

        # get per file upload credentials
        try:
            creds = _get_upload_creditials(client, internal_filename=filename, mission_id=mission_id, file_size=total_size)
        except FileExistsError:
            return UploadState.EXISTS, 0

        # build the boto3 callback that also checks for cancellation
        if on_file_progress_cb is not None or cancel_event is not None:

            def boto3_cb(bytes_amount):
                if cancel_event is not None and cancel_event.is_set():
                    raise TransferCancelledError("Transfer cancelled by user")
                if on_file_progress_cb is not None:
                    on_file_progress_cb(path, bytes_amount)

        else:
            boto3_cb = None

        try:
            _s3_upload(path, endpoint=s3_endpoint, credentials=creds, callback=boto3_cb)
        except Exception as e:
            # Check cancellation first — TransferCancelledError or any other
            # exception raised while cancel_event is set means user-requested abort.
            if cancel_event is not None and cancel_event.is_set():
                logger.info(f"Upload cancelled for {path}")
                try:
                    _cancel_file_upload(client, creds.file_id, mission_id)
                except Exception as cancel_e:
                    logger.warning(f"Failed to cancel server-side upload for {creds.file_id}: {cancel_e}")
                return UploadState.CANCELED, 0

            if _is_s3_out_of_space_error(e):
                logger.error("Upload failed: S3 storage is out of space.")
                try:
                    _cancel_file_upload(client, creds.file_id, mission_id)
                except Exception as cancel_e:
                    logger.error(f"Failed to cancel upload for {creds.file_id}: {cancel_e}")
                raise InsufficientStorageError("Insufficient storage space on the server") from e

            logger.error(format_traceback(e))
            try:
                _cancel_file_upload(client, creds.file_id, mission_id)
            except Exception as cancel_e:
                logger.error(f"Failed to cancel upload for {creds.file_id}: {cancel_e}")
                raise RuntimeError(f"Upload failed and cancellation failed for {creds.file_id}: {cancel_e}") from e

            if not retrier.record_failure(e):
                logger.error(f"Giving up on upload of {path} after {retrier.attempt} attempt(s)")
                raise
            try:
                retrier.wait(e)
            except TransferCancelledError:
                return UploadState.CANCELED, 0
            continue

        else:
            try:
                file_hash = b64_md5(path, cancel_event=cancel_event)
            except TransferCancelledError:
                # The bytes are in S3 but unconfirmed; drop them like any other cancel.
                logger.info(f"Upload cancelled for {path} while hashing")
                try:
                    _cancel_file_upload(client, creds.file_id, mission_id)
                except Exception as cancel_e:
                    logger.warning(f"Failed to cancel server-side upload for {creds.file_id}: {cancel_e}")
                return UploadState.CANCELED, 0
            _confirm_file_upload(client, creds.file_id, file_hash)
            return UploadState.UPLOADED, total_size


def _get_file_download(client: AuthenticatedClient, id: UUID) -> str:
    """\
    get the download url for a file by file id
    """
    resp = client.get(DOWNLOAD_URL.format(id), params={"expires": True, "preview_only": False})

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


def _download_error(e: Exception) -> Exception:
    """The exception to raise once a download error is final."""
    if DOWNLOAD_RETRY.retry_on(e):
        # Worth retrying, so the only reason to stop is that the attempts ran out.
        return RuntimeError(f"Download failed after {DOWNLOAD_RETRY.max_attempts} attempts: {describe_error(e)}")
    if not isinstance(e, httpx.HTTPStatusError):
        return e
    message = f"Download failed: {describe_error(e)}"
    if e.response.status_code in (401, 403):
        return AccessDenied(f"{message} (the download link may have expired or access was revoked)")
    return RuntimeError(message)


def _url_download(
    url: str,
    *,
    path: Path,
    size: int,
    overwrite: bool = False,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    cancel_event: Optional[threading.Event] = None,
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

    retrier = Retrier(DOWNLOAD_RETRY, cancel_event=cancel_event, name=f"download of {path.name}")
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
                        if cancel_event is not None and cancel_event.is_set():
                            raise TransferCancelledError("Transfer cancelled by user")
                        retrier.reset()  # progress was made, so start counting failures again
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        if on_file_progress_cb is not None:
                            on_file_progress_cb(path, len(chunk))
            break  # download complete
        except TransferCancelledError:
            raise
        except Exception as e:
            if not retrier.record_failure(e):
                raise _download_error(e) from e
            retrier.wait(e)


@dataclass(frozen=True)
class McapSlice:
    """A request for part of an MCAP file rather than the whole of it.

    Only `.mcap` can be sliced: it carries an index that maps topics and log
    times onto byte ranges, so the client can fetch just the chunks it needs.
    """

    topics: Optional[Tuple[str, ...]] = None
    start_time: Optional[int] = None
    end_time: Optional[int] = None

    def __post_init__(self) -> None:
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")

    def __bool__(self) -> bool:
        return bool(self.topics or self.start_time is not None or self.end_time is not None)


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
    DOWNLOADED_PARTIAL = 12
    SKIPPED_NOT_SLICEABLE = 13
    SKIPPED_SLICE_EXISTS = 14
    CANCELED = 15


def download_file(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    allow_corrupt_files: bool = False,
    create_parents: bool = False,
    mcap_slice: Optional[McapSlice] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    cancel_event: Optional[threading.Event] = None,
) -> Tuple[DownloadState, int]:
    """\
    Returns DownloadState and bytes downloaded (file.size if successful or skipped ok, 0 otherwise)
    """
    if cancel_event is not None and cancel_event.is_set():
        return DownloadState.CANCELED, 0

    is_corrupted = file.state == FileState.CORRUPTED

    if mcap_slice and not is_mcap(path):
        # Only MCAP carries the index this needs; anything else would have to be
        # downloaded whole and filtered locally, which defeats the purpose.
        return DownloadState.SKIPPED_NOT_SLICEABLE, 0

    if file.state not in (FileState.OK, FileState.CORRUPTED):
        return DownloadState.SKIPPED_INVALID_REMOTE_STATE, 0

    if is_corrupted and not allow_corrupt_files:
        return DownloadState.SKIPPED_CORRUPTED, 0

    if mcap_slice:
        # A slice never matches the remote hash, so an existing file cannot be
        # checked the way a full download is. It may even be the full recording;
        # replacing it with a slice needs to be asked for.
        if path.exists() and not overwrite:
            return DownloadState.SKIPPED_SLICE_EXISTS, 0
        return _download_mcap_slice(
            client,
            file=file,
            path=path,
            mcap_slice=mcap_slice,
            create_parents=create_parents,
            on_file_start_cb=on_file_start_cb,
            on_file_progress_cb=on_file_progress_cb,
            cancel_event=cancel_event,
        )

    was_overwritten = False
    if path.exists():

        # compare file size
        if file.size == path.stat().st_size:
            try:
                local_hash = b64_md5(path, cancel_event=cancel_event)
            except TransferCancelledError:
                return DownloadState.CANCELED, 0
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

    # Nothing has been touched yet. Past this point a cancel removes the target,
    # so with --overwrite a Ctrl+C during the URL request would delete the old copy.
    if cancel_event is not None and cancel_event.is_set():
        return DownloadState.CANCELED, 0

    # create parent directories
    if create_parents:
        path.parent.mkdir(parents=True, exist_ok=True)

    # download the file and check the hash
    had_prior_bytes = not overwrite and path.exists() and path.stat().st_size > 0
    try:
        _url_download(
            download_url,
            path=path,
            size=file.size,
            overwrite=overwrite,
            on_file_start_cb=on_file_start_cb,
            on_file_progress_cb=on_file_progress_cb,
            cancel_event=cancel_event,
        )
    except Exception as e:
        # If cancel was requested, treat as cancellation regardless of exception type
        if cancel_event is not None and cancel_event.is_set():
            logger.info(f"Download cancelled for {path}")
            if (not had_prior_bytes or overwrite) and path.exists():
                try:
                    path.unlink()
                    logger.info(f"Removed potentially incomplete file {path}")
                except OSError as unlink_e:
                    logger.error(f"Could not remove partial file {path}: {unlink_e}")
            return DownloadState.CANCELED, 0

        logger.error(f"Error during download of {path}: {e}")
        # Only clean up files we created; preserve prior bytes for resume
        if (not had_prior_bytes or overwrite) and path.exists():
            try:
                path.unlink()
                logger.info(f"Removed potentially incomplete file {path}")
            except OSError as unlink_e:
                logger.error(f"Could not remove partial file {path}: {unlink_e}")
        raise e  # Re-raise to be caught by handler

    try:
        observed_hash = b64_md5(path, cancel_event=cancel_event)
    except TransferCancelledError:
        # The download itself finished, so keep the file: the next run checks
        # its hash and skips it if it is fine.
        logger.info(f"Download cancelled for {path} while verifying its hash")
        return DownloadState.CANCELED, 0
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
    canceled: int = 0
    total_bytes: int = 0
    elapsed_seconds: float = 0.0
    # local files the server refused because their name is taken in the mission
    existing: List[Path] = field(default_factory=list)
    # of `existing`: the content differs from the file in the mission, so the
    # local file was NOT uploaded (filled in by `kleinkram.core.upload`)
    conflicts: List[Path] = field(default_factory=list)
    # of `existing`: the content could not be compared, because the file in the
    # mission is not in state OK yet or the mission's files could not be read
    # (filled in by `kleinkram.core.upload`)
    unchecked: List[Path] = field(default_factory=list)


# download outcomes where the requested file did NOT end up as asked; `klein
# download` exits with 1 if any file ends in one of them (failures count too)
DOWNLOAD_STATES_NOT_DONE = frozenset(
    {
        DownloadState.DOWNLOADED_INVALID_HASH,
        DownloadState.SKIPPED_INVALID_HASH,
        DownloadState.SKIPPED_FILE_SIZE_MISMATCH,
        DownloadState.SKIPPED_INVALID_REMOTE_STATE,
        DownloadState.SKIPPED_CORRUPTED,
        DownloadState.SKIPPED_SLICE_EXISTS,
    }
)


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
        DownloadState.SKIPPED_INVALID_HASH: (f"skipped {path}, exists with hash mismatch (use --overwrite?)", True),
        DownloadState.SKIPPED_FILE_SIZE_MISMATCH: (
            f"skipped {path}, exists with file size mismatch (use --overwrite?)",
            True,
        ),
        DownloadState.SKIPPED_INVALID_REMOTE_STATE: (
            f"skipped {path}, remote file has invalid state ({file.state.value})"
            + (f": {file.state_comment}" if file.state_comment else ""),
            True,
        ),
        DownloadState.DOWNLOADED_PARTIAL: (
            f"downloaded a filtered slice of {path}",
            False,
        ),
        DownloadState.SKIPPED_NOT_SLICEABLE: (
            f"skipped {path}, only .mcap files can be downloaded partially",
            False,
        ),
        DownloadState.SKIPPED_SLICE_EXISTS: (
            f"skipped {path}, already exists (use --overwrite to replace it with the slice)",
            True,
        ),
        DownloadState.SKIPPED_CORRUPTED: (
            f"skipped {path}, remote file is CORRUPTED"
            + (f": {file.state_comment}" if file.state_comment else "")
            + " (use --allow-corrupt to override)",
            True,
        ),
        DownloadState.SKIPPED_CORRUPTED_LOCAL_OK: (
            f"skipped {path}, already present locally (hash ok) but remote file is CORRUPTED; " "treat as potentially harmful",
            True,
        ),
        DownloadState.CANCELED: (f"canceled {path} download", False),
    }
    return messages.get(state)


def _resolve_upload_future(
    future: Future[Tuple[UploadState, int]],
    path: Path,
    result: UploadResult,
    cancel_event: threading.Event,
    recorded: Set[Future],
    executor: Optional[ThreadPoolExecutor] = None,
    on_message_cb: Optional[OnMessageCb] = None,
    on_overall_progress_cb: Optional[OnOverallProgressCb] = None,
    is_cleanup: bool = False,
) -> None:
    """Resolves an upload future, updates telemetry, and triggers callbacks.

    The future goes into `recorded` as soon as it is counted, before any
    callback runs, so a Ctrl+C inside a callback does not count it twice.
    """
    if future.cancelled():
        result.canceled += 1
        recorded.add(future)
        if on_overall_progress_cb is not None:
            on_overall_progress_cb()
        return

    try:
        state, size_bytes = future.result()
    except InsufficientStorageError as e:
        if on_message_cb is not None:
            on_message_cb("Upload failed: Insufficient storage space on the server", True)
        cancel_event.set()
        if executor is not None:
            executor.shutdown(wait=False, cancel_futures=True)
        if not is_cleanup:
            raise e
        return
    except Exception as e:
        result.failed += 1
        recorded.add(future)
        logger.error(format_traceback(e))
        if on_message_cb is not None:
            on_message_cb(f"Error uploading {path}: {e}", True)
        if on_overall_progress_cb is not None:
            on_overall_progress_cb()
        return

    result.total_bytes += size_bytes
    if state == UploadState.UPLOADED:
        result.uploaded += 1
        message = f"uploaded {path}"
    elif state == UploadState.EXISTS:
        result.skipped += 1
        result.existing.append(path)
        message = f"skipped {path} (already uploaded)"
    else:
        result.canceled += 1
        message = f"canceled {path} upload"
    recorded.add(future)

    if on_message_cb is not None:
        on_message_cb(message, False)

    if on_overall_progress_cb is not None:
        on_overall_progress_cb()


def _wait_for_cancelled_workers(futures: Dict[Future, object]) -> None:
    """After Ctrl+C, wait until the running workers have seen the cancel event.

    They stop at their next chunk or callback, cancel unconfirmed uploads and
    remove partial downloads, so their final state is known before the summary
    is built. A second Ctrl+C stops waiting.
    """
    # Futures that `shutdown(cancel_futures=True)` cancelled never count as
    # done for `wait()` on older Pythons, so only wait for the running ones.
    running = [f for f in futures if not f.cancelled()]
    try:
        wait(running)
    except KeyboardInterrupt:
        logger.info("Interrupted again, not waiting for running transfers")


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
    cancel_event = threading.Event()
    interrupted = False
    recorded: Set[Future] = set()

    executor = ThreadPoolExecutor(max_workers=n_workers)
    try:
        for name, path in files.items():
            if not path.is_file():
                # it was checked before; it vanished since, so it is not uploaded
                logger.error(f"File disappeared before upload: {path}")
                if on_message_cb is not None:
                    on_message_cb(f"Error uploading {path}: file does not exist anymore", True)
                result.failed += 1
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
                cancel_event=cancel_event,
            )
            futures[future] = path

        for future in as_completed(futures):
            _resolve_upload_future(
                future=future,
                path=futures[future],
                result=result,
                cancel_event=cancel_event,
                recorded=recorded,
                executor=executor,
                on_message_cb=on_message_cb,
                on_overall_progress_cb=on_overall_progress_cb,
            )

    except KeyboardInterrupt:
        logger.info("Upload interrupted by user, cancelling...")
        interrupted = True
        cancel_event.set()
        executor.shutdown(wait=False, cancel_futures=True)
        _wait_for_cancelled_workers(futures)
    except BaseException:
        # any other error, e.g. from a callback: stop the transfers as Ctrl+C
        # does, so none of them keeps running after this call has failed
        cancel_event.set()
        executor.shutdown(wait=False, cancel_futures=True)
        _wait_for_cancelled_workers(futures)
        raise
    else:
        executor.shutdown(wait=True)

    if interrupted:
        for future, path in futures.items():
            if future in recorded:
                continue
            if not future.done():
                result.canceled += 1
                if on_overall_progress_cb is not None:
                    on_overall_progress_cb()
                continue
            _resolve_upload_future(
                future=future,
                path=path,
                result=result,
                cancel_event=cancel_event,
                recorded=recorded,
                on_message_cb=on_message_cb,
                on_overall_progress_cb=on_overall_progress_cb,
                is_cleanup=True,
            )

    result.elapsed_seconds = monotonic() - start
    if interrupted:
        if on_message_cb is not None:
            on_message_cb("Upload interrupted by user", True)
        # Cleanup is done; hand the Ctrl+C back to the caller.
        raise transfer_interrupted(result)
    return result


def _download_mcap_slice(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    mcap_slice: McapSlice,
    create_parents: bool = False,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    cancel_event: Optional[threading.Event] = None,
) -> Tuple[DownloadState, int]:
    """Write a filtered copy of a remote MCAP, fetching only the bytes it needs.

    `filter_mcap_from_url` only replaces `path` once the slice is complete, so
    a failure or cancellation leaves whatever was there before untouched.
    """
    download_url = _get_file_download(client, file.id)

    if create_parents:
        path.parent.mkdir(parents=True, exist_ok=True)

    def check_cancel() -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise TransferCancelledError("Transfer cancelled by user")

    def on_start(total: int) -> None:
        check_cancel()
        if on_file_start_cb is not None:
            on_file_start_cb(path, total)

    # Progress is reported per fetched range, so checking here lets Ctrl+C stop
    # a slice download between requests instead of only once it is complete.
    def on_progress(n: int) -> None:
        check_cancel()
        if on_file_progress_cb is not None:
            on_file_progress_cb(path, n)

    try:
        result = filter_mcap_from_url(
            download_url,
            path,
            topics=mcap_slice.topics,
            start_time=mcap_slice.start_time,
            end_time=mcap_slice.end_time,
            on_start=on_start,
            on_progress=on_progress,
            cancel_event=cancel_event,
        )
    except Exception as e:
        if cancel_event is not None and cancel_event.is_set():
            logger.info(f"Partial download cancelled for {path}")
            return DownloadState.CANCELED, 0
        logger.error(f"Error during partial download of {path}: {e}")
        raise

    # A slice is a different file from the remote one, so the remote hash and
    # size deliberately are not checked here.
    return DownloadState.DOWNLOADED_PARTIAL, result.bytes_fetched


def _resolve_download_future(
    future: Future[Tuple[DownloadState, int]],
    path: Path,
    file: File,
    result: DownloadResult,
    recorded: Set[Future],
    on_message_cb: Optional[OnMessageCb] = None,
    on_overall_progress_cb: Optional[OnOverallProgressCb] = None,
) -> None:
    """Resolves a download future, updates telemetry, and triggers callbacks.

    Like `_resolve_upload_future`, it adds the future to `recorded` before
    any callback runs.
    """
    if future.cancelled():
        result.state_counts[DownloadState.CANCELED] = result.state_counts.get(DownloadState.CANCELED, 0) + 1
        recorded.add(future)
        if on_overall_progress_cb is not None:
            on_overall_progress_cb()
        return

    try:
        state, size_bytes = future.result()
    except Exception as e:
        result.failed += 1
        recorded.add(future)
        logger.error(format_traceback(e))
        if on_message_cb is not None:
            on_message_cb(f"Error downloading {path}: {e}", True)
        if on_overall_progress_cb is not None:
            on_overall_progress_cb()
        return

    result.state_counts[state] = result.state_counts.get(state, 0) + 1

    if state in (
        DownloadState.DOWNLOADED_PARTIAL,
        DownloadState.DOWNLOADED_OK,
        DownloadState.DOWNLOADED_CORRUPTED,
        DownloadState.SKIPPED_OK,
        DownloadState.OVERWRITTEN_OK,
        DownloadState.OVERWRITTEN_CORRUPTED,
    ):
        result.total_bytes += size_bytes
    recorded.add(future)

    if on_message_cb is not None:
        msg = _download_state_message(state, path, file)
        if msg is not None:
            on_message_cb(*msg)

    if on_overall_progress_cb is not None:
        on_overall_progress_cb()


def download_files(
    client: AuthenticatedClient,
    files: Dict[Path, File],
    *,
    overwrite: bool = False,
    allow_corrupt_files: bool = False,
    create_parents: bool = False,
    mcap_slice: Optional[McapSlice] = None,
    n_workers: int = 2,
    on_overall_progress_cb: Optional[OnOverallProgressCb] = None,
    on_file_start_cb: Optional[OnFileStartCb] = None,
    on_file_progress_cb: Optional[OnFileProgressCb] = None,
    on_message_cb: Optional[OnMessageCb] = None,
) -> DownloadResult:
    start = monotonic()
    futures: Dict[Future[Tuple[DownloadState, int]], Tuple[File, Path]] = {}
    result = DownloadResult()
    cancel_event = threading.Event()
    interrupted = False
    recorded: Set[Future] = set()

    executor = ThreadPoolExecutor(max_workers=n_workers)
    try:
        for path, file in files.items():
            future = executor.submit(
                download_file,
                client=client,
                file=file,
                path=path,
                overwrite=overwrite,
                allow_corrupt_files=allow_corrupt_files,
                create_parents=create_parents,
                mcap_slice=mcap_slice,
                on_file_start_cb=on_file_start_cb,
                on_file_progress_cb=on_file_progress_cb,
                cancel_event=cancel_event,
            )
            futures[future] = (file, path)

        for future in as_completed(futures):
            file, path = futures[future]
            _resolve_download_future(
                future=future,
                path=path,
                file=file,
                result=result,
                recorded=recorded,
                on_message_cb=on_message_cb,
                on_overall_progress_cb=on_overall_progress_cb,
            )

    except KeyboardInterrupt:
        logger.info("Download interrupted by user, cancelling...")
        interrupted = True
        cancel_event.set()
        executor.shutdown(wait=False, cancel_futures=True)
        _wait_for_cancelled_workers(futures)
    except BaseException:
        # any other error, e.g. from a callback: stop the transfers as Ctrl+C
        # does, so none of them keeps running after this call has failed
        cancel_event.set()
        executor.shutdown(wait=False, cancel_futures=True)
        _wait_for_cancelled_workers(futures)
        raise
    else:
        executor.shutdown(wait=True)

    if interrupted:
        for future, (file, path) in futures.items():
            if future in recorded:
                continue
            if not future.done():
                result.state_counts[DownloadState.CANCELED] = result.state_counts.get(DownloadState.CANCELED, 0) + 1
                if on_overall_progress_cb is not None:
                    on_overall_progress_cb()
                continue
            _resolve_download_future(
                future=future,
                path=path,
                file=file,
                result=result,
                recorded=recorded,
                on_message_cb=on_message_cb,
                on_overall_progress_cb=on_overall_progress_cb,
            )

    result.elapsed_seconds = monotonic() - start
    if interrupted:
        if on_message_cb is not None:
            on_message_cb("Download interrupted by user", True)
        # Cleanup is done; hand the Ctrl+C back to the caller.
        raise transfer_interrupted(result)
    return result
