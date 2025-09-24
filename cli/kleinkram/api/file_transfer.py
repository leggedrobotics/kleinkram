from __future__ import annotations

import logging
import sys
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import as_completed
from enum import Enum
from pathlib import Path
from time import monotonic, sleep
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
from kleinkram.utils import format_bytes
from kleinkram.utils import format_error
from kleinkram.utils import format_traceback
from kleinkram.utils import styled_string

logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/files/temporaryAccess"
UPLOAD_CONFIRM = "/queue/confirmUpload"
UPLOAD_CANCEL = "/files/cancelUpload"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/files/download"

MAX_UPLOAD_RETRIES = 3
S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes

RETRY_BACKOFF_BASE = 2  # exponential backoff base
MAX_RETRIES = 5


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


def _get_upload_credentials_with_retry(
    client, pbar, filename, mission_id, max_attempts=5
):
    """
    Retrieves upload credentials with retry logic.

    Args:
        client: The client object used for retrieving credentials.
        filename: The internal filename.
        mission_id: The mission ID.
        max_attempts: Maximum number of retry attempts.

    Returns:
        The upload credentials or None if retrieval fails after all attempts.
    """
    attempt = 0
    while attempt < max_attempts:
        creds = _get_upload_creditials(
            client, internal_filename=filename, mission_id=mission_id
        )
        if creds is not None:
            return creds

        attempt += 1
        if attempt < max_attempts:
            delay = 2**attempt  # Exponential backoff (2, 4, 8, 16...)
            sleep(delay)

    return None


# TODO: i dont want to handle errors at this level
def upload_file(
    client: AuthenticatedClient,
    *,
    mission_id: UUID,
    filename: str,
    path: Path,
    verbose: bool = False,
    s3_endpoint: Optional[str] = None,
) -> Tuple[UploadState, int]:
    """
    returns UploadState and bytes uploaded (0 if not uploaded)
    Retries up to 3 times on failure.
    """
    if s3_endpoint is None:
        s3_endpoint = get_config().endpoint.s3

    total_size = path.stat().st_size
    for attempt in range(MAX_UPLOAD_RETRIES):
        with tqdm(
            total=total_size,
            unit="B",
            unit_scale=True,
            desc=f"uploading {path}...",
            leave=False,
            disable=not verbose,
        ) as pbar:

            # get per file upload credentials
            creds = _get_upload_credentials_with_retry(
                client, pbar, filename, mission_id, max_attempts=5 if attempt > 0 else 1
            )

            if creds is None:
                return UploadState.EXISTS, 0

            try:
                _s3_upload(path, endpoint=s3_endpoint, credentials=creds, pbar=pbar)
            except Exception as e:
                logger.error(format_traceback(e))
                try:
                    _cancel_file_upload(client, creds.file_id, mission_id)
                except Exception as cancel_e:
                    logger.error(
                        f"Failed to cancel upload for {creds.file_id}: {cancel_e}"
                    )

                if attempt < 2:  # Retry if not the last attempt
                    pbar.update(0)
                    logger.error(f"Retrying upload for {attempt + 1}")
                    continue
                else:
                    logger.error(f"Cancelling upload for {attempt}")
                    raise e from e

            else:
                _confirm_file_upload(client, creds.file_id, b64_md5(path))
                return UploadState.UPLOADED, total_size


def _get_file_download(client: AuthenticatedClient, id: UUID) -> str:
    """\
    get the download url for a file by file id
    """
    resp = client.get(DOWNLOAD_URL, params={"uuid": str(id), "expires": True})

    if 400 <= resp.status_code < 500:
        raise AccessDenied(
            f"Failed to download file: {resp.json()['message']}"
            f" Status Code: {resp.status_code}",
        )

    resp.raise_for_status()

    return resp.text


def _url_download(
    url: str, *, path: Path, size: int, overwrite: bool = False, verbose: bool = False
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

    attempt = 0
    while downloaded < size:
        try:
            headers = {"Range": f"bytes={downloaded}-"}
            with httpx.stream(
                "GET", url, headers=headers, timeout=S3_READ_TIMEOUT
            ) as response:
                # Accept both 206 Partial Content and 200 OK if starting from 0
                if not (
                    response.status_code == 206
                    or (downloaded == 0 and response.status_code == 200)
                ):
                    response.raise_for_status()
                    raise RuntimeError(
                        f"Expected 206 Partial Content, got {response.status_code}"
                    )

                mode = "ab" if downloaded > 0 else "wb"
                with open(path, mode) as f:
                    with tqdm(
                        total=size,
                        initial=downloaded,
                        desc=f"downloading {path.name}",
                        unit="B",
                        unit_scale=True,
                        leave=False,
                        disable=not verbose,
                    ) as pbar:
                        for chunk in response.iter_bytes(
                            chunk_size=DOWNLOAD_CHUNK_SIZE
                        ):
                            attempt = 0  # reset attempt counter on successful download of non-empty chunk
                            if not chunk:
                                break
                            f.write(chunk)
                            downloaded += len(chunk)
                            pbar.update(len(chunk))
            break  # download complete
        except Exception as e:
            logger.info(f"Error: {e}, retrying...")
            attempt += 1
            if attempt > MAX_RETRIES:
                raise RuntimeError(
                    f"Download failed after {MAX_RETRIES} retries due to {e}"
                ) from e
            if verbose:
                print(
                    f"{e} on attempt {attempt}/{MAX_RETRIES}, retrying after backoff..."
                )
            sleep(RETRY_BACKOFF_BASE**attempt)


class DownloadState(Enum):
    DOWNLOADED_OK = 1
    SKIPPED_OK = 2
    DOWNLOADED_INVALID_HASH = 3
    SKIPPED_INVALID_HASH = 4
    SKIPPED_INVALID_REMOTE_STATE = 5
    SKIPPED_FILE_SIZE_MISMATCH = 6


def download_file(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    verbose: bool = False,
) -> Tuple[DownloadState, int]:
    """\
    Returns DownloadState and bytes downloaded (file.size if successful or skipped ok, 0 otherwise)
    """
    # skip files that are not ok on remote
    if file.state != FileState.OK:
        return DownloadState.SKIPPED_INVALID_REMOTE_STATE, 0

    if path.exists():

        # compare file size
        if file.size == path.stat().st_size:
            local_hash = b64_md5(path)
            if local_hash != file.hash and not overwrite and file.hash is not None:
                return DownloadState.SKIPPED_INVALID_HASH, 0

            elif local_hash == file.hash:
                return DownloadState.SKIPPED_OK, 0

            elif verbose:
                tqdm.write(
                    styled_string(f"overwriting {path}, hash mismatch", style="yellow")
                )

        elif not overwrite and file.size is not None:
            return DownloadState.SKIPPED_FILE_SIZE_MISMATCH, 0

        elif verbose:
            tqdm.write(
                styled_string(f"overwriting {path}, file size mismatch", style="yellow")
            )

    # request a download url
    download_url = _get_file_download(client, file.id)

    # create parent directories (moved earlier, before file open)
    # path.parent.mkdir(parents=True, exist_ok=True)

    # download the file and check the hash
    try:
        _url_download(
            download_url,
            path=path,
            size=file.size,
            overwrite=overwrite,
            verbose=verbose,
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
        # Download completed but hash failed
        return (
            DownloadState.DOWNLOADED_INVALID_HASH,
            0,
        )  # 0 bytes considered successful transfer
    # Hash matches or no remote hash to check against
    return DownloadState.DOWNLOADED_OK, file.size


UPLOAD_STATE_COLOR = {
    UploadState.UPLOADED: "green",
    UploadState.EXISTS: "yellow",
    UploadState.CANCELED: "red",
}


def _upload_handler(
    future: Future[Tuple[UploadState, int]], path: Path, *, verbose: bool = False
) -> int:
    """Returns bytes uploaded successfully."""
    state = UploadState.CANCELED  # Default to canceled if exception occurs
    size_bytes = 0
    try:
        state, size_bytes = future.result()
    except Exception as e:
        logger.error(format_traceback(e))
        if verbose:
            tqdm.write(format_error(f"error uploading", e, verbose=verbose))
        else:
            print(f"ERROR: {path.absolute()}: {e}", file=sys.stderr)
        return 0  # Return 0 bytes on error

    if state == UploadState.UPLOADED:
        msg = f"uploaded {path}"
    elif state == UploadState.EXISTS:
        msg = f"skipped {path} already uploaded"
    else:
        msg = f"canceled {path} upload"

    if verbose:
        tqdm.write(styled_string(msg, style=UPLOAD_STATE_COLOR[state]))
    elif state != UploadState.UPLOADED:
        print(f"SKIP/CANCEL: {path.absolute()}", file=sys.stderr)

    return size_bytes


DOWNLOAD_STATE_COLOR = {
    DownloadState.DOWNLOADED_OK: "green",
    DownloadState.SKIPPED_OK: "green",
    DownloadState.DOWNLOADED_INVALID_HASH: "red",
    DownloadState.SKIPPED_INVALID_HASH: "yellow",
    DownloadState.SKIPPED_FILE_SIZE_MISMATCH: "yellow",
    DownloadState.SKIPPED_INVALID_REMOTE_STATE: "purple",
}


def _download_handler(
    future: Future[Tuple[DownloadState, int]],
    file: File,
    path: Path,
    *,
    verbose: bool = False,
) -> int:
    """Returns bytes downloaded/verified."""
    state = DownloadState.DOWNLOADED_INVALID_HASH
    size_bytes = 0
    try:
        state, size_bytes = future.result()
    except Exception as e:
        logger.error(format_traceback(e))
        if verbose:
            tqdm.write(format_error(f"error downloading {path}", e))
        else:
            print(f"ERROR: {path.absolute()}: {e}", file=sys.stderr)
        return 0

    if state == DownloadState.DOWNLOADED_OK:
        msg = f"downloaded {path}"
    elif state == DownloadState.DOWNLOADED_INVALID_HASH:
        msg = f"downloaded {path} but failed hash check"
    elif state == DownloadState.SKIPPED_OK:
        msg = f"skipped {path} already downloaded (hash ok)"
    elif state == DownloadState.SKIPPED_INVALID_HASH:
        msg = f"skipped {path}, exists with hash mismatch (use --overwrite?)"
    elif state == DownloadState.SKIPPED_FILE_SIZE_MISMATCH:
        msg = f"skipped {path}, exists with file size mismatch (use --overwrite?)"
    elif state == DownloadState.SKIPPED_INVALID_REMOTE_STATE:
        msg = f"skipped {path}, remote file has invalid state ({file.state.value})"
    else:
        msg = f"skipped {path} with unknown state {state}"

    if verbose:
        tqdm.write(styled_string(msg, style=DOWNLOAD_STATE_COLOR.get(state, "red")))
    elif state not in (DownloadState.DOWNLOADED_OK, DownloadState.SKIPPED_OK):
        print(f"SKIP/FAIL: {path.absolute()} ({state.name})", file=sys.stderr)

    return (
        size_bytes
        if state in (DownloadState.DOWNLOADED_OK, DownloadState.SKIPPED_OK)
        else 0
    )


def upload_files(
    client: AuthenticatedClient,
    files: Dict[str, Path],
    mission_id: UUID,
    *,
    verbose: bool = False,
    n_workers: int = 2,
) -> None:
    console = Console(file=sys.stderr)
    with tqdm(
        total=len(files),
        unit="files",
        desc="Uploading files",
        disable=not verbose,
        leave=False,
    ) as pbar:
        start = monotonic()
        futures: Dict[Future[Tuple[UploadState, int]], Path] = {}

        skipped_files = 0
        failed_files = 0
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for name, path in files.items():
                if not path.is_file():
                    console.print(
                        f"[yellow]Skipping non-existent file: {path}[/yellow]"
                    )
                    pbar.update()
                    continue

                future = executor.submit(
                    upload_file,
                    client=client,
                    mission_id=mission_id,
                    filename=name,
                    path=path,
                    verbose=verbose,
                )
                futures[future] = path

            total_uploaded_bytes = 0
            for future in as_completed(futures):

                if future.exception():
                    failed_files += 1

                if (
                    future.exception() is None
                    and future.result()[0] == UploadState.EXISTS
                ):
                    skipped_files += 1

                path = futures[future]
                uploaded_bytes = _upload_handler(future, path, verbose=verbose)
                total_uploaded_bytes += uploaded_bytes
                pbar.update()

        end = monotonic()
        elapsed_time = end - start

        avg_speed_bps = total_uploaded_bytes / elapsed_time if elapsed_time > 0 else 0

        if verbose:
            console.print(f"Upload took {elapsed_time:.2f} seconds")
            console.print(f"Total uploaded: {format_bytes(total_uploaded_bytes)}")
            console.print(f"Average speed: {format_bytes(avg_speed_bps, speed=True)}")

            if failed_files > 0:
                console.print(
                    f"\nUploaded {len(files) - failed_files - skipped_files} files, {skipped_files} skipped, {failed_files} uploads failed",
                    style="red",
                )
            else:
                console.print(
                    f"\nUploaded {len(files) - skipped_files} files, {skipped_files} skipped"
                )


def download_files(
    client: AuthenticatedClient,
    files: Dict[Path, File],
    *,
    verbose: bool = False,
    overwrite: bool = False,
    n_workers: int = 2,
) -> None:
    console = Console(file=sys.stderr)
    with tqdm(
        total=len(files),
        unit="files",
        desc="Downloading files",
        disable=not verbose,
        leave=False,
    ) as pbar:

        start = monotonic()
        futures: Dict[Future[Tuple[DownloadState, int]], Tuple[File, Path]] = {}
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

            total_downloaded_bytes = 0
            for future in as_completed(futures):
                file, path = futures[future]
                downloaded_bytes = _download_handler(
                    future, file, path, verbose=verbose
                )
                total_downloaded_bytes += downloaded_bytes
                pbar.update()

        end = monotonic()
        elapsed_time = end - start
        avg_speed_bps = total_downloaded_bytes / elapsed_time if elapsed_time > 0 else 0

        console.print(f"Download took {elapsed_time:.2f} seconds")
        console.print(
            f"Total downloaded/verified: {format_bytes(total_downloaded_bytes)}"
        )
        console.print(f"Average speed: {format_bytes(avg_speed_bps, speed=True)}")
