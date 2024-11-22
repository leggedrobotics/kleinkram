from __future__ import annotations

import logging
import sys
from concurrent.futures import Future
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from time import monotonic
from typing import Dict
from typing import NamedTuple
from uuid import UUID

import boto3.s3.transfer
import botocore.config
import httpx
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import Config
from kleinkram.config import LOCAL_S3
from kleinkram.errors import AccessDenied
from kleinkram.errors import CancelUploadFailed
from kleinkram.errors import ConfirmUploadFailed
from kleinkram.errors import CorruptedFile
from kleinkram.errors import DownloadFailed
from kleinkram.errors import UploadCredentialsFailed
from kleinkram.errors import UploadFailed
from kleinkram.models import File
from kleinkram.models import FILE_STATE_COLOR
from kleinkram.models import FileState
from kleinkram.utils import b64_md5
from kleinkram.utils import format_error
from kleinkram.utils import format_traceback
from kleinkram.utils import styled_string
from rich.console import Console
from rich.text import Text
from tqdm import tqdm


logger = logging.getLogger(__name__)

UPLOAD_CREDS = "/file/temporaryAccess"
UPLOAD_CONFIRM = "/queue/confirmUpload"
UPLOAD_CANCEL = "/file/cancelUpload"

DOWNLOAD_CHUNK_SIZE = 1024 * 1024 * 16
DOWNLOAD_URL = "/file/download"

S3_MAX_RETRIES = 60  # same as frontend
S3_READ_TIMEOUT = 60 * 5  # 5 minutes


# fields for upload credentials
ACCESS_KEY_FIELD = "accessKey"
SECRET_KEY_FIELD = "secretKey"
SESSION_TOKEN_FIELD = "sessionToken"
CREDENTIALS_FIELD = "accessCredentials"
FILE_ID_FIELD = "fileUUID"
BUCKET_FIELD = "bucket"

FILE_EXISTS_ERROR = "File already exists"


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
        raise CorruptedFile("failed to confirm upload")
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


def _get_upload_creditials(
    client: AuthenticatedClient, internal_filename: str, mission_id: UUID
) -> UploadCredentials:
    dct = {
        "filenames": [internal_filename],
        "missionUUID": str(mission_id),
    }
    resp = client.post(UPLOAD_CREDS, json=dct)

    if resp.status_code >= 400:
        raise UploadCredentialsFailed

    # TODO handle file exists

    try:
        data = resp.json()[0]

        if data.get("error") == FILE_EXISTS_ERROR:
            raise FileExistsError

        bucket = data[BUCKET_FIELD]
        file_id = UUID(data[FILE_ID_FIELD], version=4)

        creds = data[CREDENTIALS_FIELD]
        access_key = creds[ACCESS_KEY_FIELD]
        secret_key = creds[SECRET_KEY_FIELD]
        session_token = creds[SESSION_TOKEN_FIELD]

    except (IndexError, KeyError):
        raise UploadCredentialsFailed

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


def upload_file(
    client: AuthenticatedClient,
    *,
    mission_id: UUID,
    filename: str,
    path: Path,
    verbose: bool = False,
) -> int:
    """\
    returns bytes uploaded
    """

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
        endpoint = _get_s3_endpoint()

        try:
            _s3_upload(path, endpoint=endpoint, credentials=creds, pbar=pbar)
        except Exception:
            # try cancelling the upload
            _cancel_file_upload(client, creds.file_id, mission_id)
            raise
        else:
            _confirm_file_upload(client, creds.file_id, b64_md5(path))

    return total_size


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


class FileStateInvalid(Exception): ...


class FileSkippedOK(Exception): ...


class FileSkippedInvalidHash(Exception): ...


def download_file(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    _verbose: bool = False,
) -> int:
    # skip files that are not ok on remote
    if file.state != FileState.OK:
        raise FileStateInvalid(
            f"file {file.name} is not in OK state: {file.state}",
        )

    # skip existing files depending on flags set
    if path.exists():
        base_message = f"{file.name} already exists in dest"
        local_hash = b64_md5(path)
        if local_hash != file.hash and not overwrite:
            raise FileSkippedInvalidHash(
                f"{base_message} with missmatching hash",
            )
        elif local_hash == file.hash:
            raise FileSkippedOK(
                f"{base_message} with matching hash",
            )
        if _verbose:
            tqdm.write(
                styled_string(
                    f"{base_message} with missmatching hash, overwriting...",
                    style="green",
                )
            )

    # request a download url
    download_url = _get_file_download(client, file.id)

    # create parent directories
    path.parent.mkdir(parents=True, exist_ok=True)

    # download the file and check the hash
    _url_download(
        download_url, path=path, size=file.size, overwrite=overwrite, verbose=_verbose
    )
    observed_hash = b64_md5(path)
    if file.hash is not None and observed_hash != file.hash:
        raise CorruptedFile(f"file hash does not match: {path}")

    return file.size


def _wrapped_download(
    client: AuthenticatedClient,
    *,
    file: File,
    path: Path,
    overwrite: bool = False,
    verbose: bool = False,
    progress: tqdm,
) -> int:
    """\
    allows multiple downloads to be run concurrently and wrapped with a progress bar
    this function also handles error and status messages

    this function should only raise unrecoverable, uknown or unhandled errors
    """
    try:
        ret = download_file(
            client=client, file=file, path=path, overwrite=overwrite, _verbose=verbose
        )
    except (FileStateInvalid, FileSkippedInvalidHash) as e:
        if verbose:
            tqdm.write(format_error(f"error downloading {file.name}", e))
        else:
            print(path.absolute(), file=sys.stderr)
        logger.error(format_traceback(e))
        return 0
    except FileSkippedOK:
        msg = f"{path} already downloaded, skipping..."
        if verbose:
            tqdm.write(styled_string(msg, style="yellow"))
        else:
            print(path.absolute())
        logger.info(msg)
        return 0
    else:
        msg = f"downloaded {path}"
        if verbose:
            tqdm.write(styled_string(msg, style="green"))
        else:
            print(path.absolute())
        logger.info(msg)
        return ret
    finally:
        progress.update()


def _wrapped_upload(
    client: AuthenticatedClient,
    *,
    mission_id: UUID,
    filename: str,
    path: Path,
    verbose: bool,
    progress: tqdm,
) -> int:
    """\
    allows multiple uploads to be run concurrently and wrapped with a progress bar
    this function also handles error and status messages
    """
    try:
        ret = upload_file(
            client, mission_id=mission_id, filename=filename, path=path, verbose=verbose
        )
    except FileExistsError as e:
        # TODO: we should check if the hashes match
        logger.error(format_traceback(e))
        if verbose:
            tqdm.write(
                styled_string(f"{path} already uploaded, skipping...", style="yellow")
            )
        else:
            print(path.absolute())  # TODO: should it be stderr?
        return 0
    except (UploadCredentialsFailed, CancelUploadFailed, ConfirmUploadFailed) as e:
        if verbose:
            tqdm.write(format_error(f"error uploading {path}", e))
        else:
            print(path.absolute(), file=sys.stderr)
        logger.error(format_traceback(e))
        return 0
    else:
        msg = f"uploaded {path}"
        if verbose:
            tqdm.write(styled_string(msg, style="green"))
        else:
            print(path.absolute())
        logger.info(msg)
        return ret
    finally:
        progress.update()


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
    ) as pbar:

        start = monotonic()
        futures: Dict[File, Future[int]] = {}
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for path, file in files.items():
                future = executor.submit(
                    _wrapped_download,
                    client=client,
                    file=file,
                    path=path,
                    overwrite=overwrite,
                    verbose=verbose,
                    progress=pbar,
                )
                futures[file] = future

        errors = []
        total_size = 0
        for file, future in futures.items():
            try:
                total_size += future.result() / 1024 / 1024  # convert to MB
            except Exception as e:
                errors.append(e)
                logger.error(format_traceback(e))
                print(
                    format_error(
                        f"error downloading file {file.name}", e, verbose=verbose
                    ),
                    file=sys.stderr,
                )

        time = monotonic() - start
        c = Console(file=sys.stderr)
        c.print(f"download took {time:.2f} seconds")
        c.print(f"total size: {int(total_size)} MB")
        c.print(f"average speed: {total_size  / time:.2f} MB/s")

        if errors:
            raise DownloadFailed(f"got unhandled errors: {errors} during download")


def upload_files(
    client: AuthenticatedClient,
    files_map: Dict[str, Path],
    mission_id: UUID,
    *,
    verbose: bool = False,
    n_workers: int = 2,
) -> None:
    with tqdm(
        total=len(files_map),
        unit="files",
        desc="uploading files",
        disable=not verbose,
    ) as pbar:
        start = monotonic()
        futures: Dict[Path, Future[int]] = {}
        with ThreadPoolExecutor(max_workers=n_workers) as executor:
            for name, path in files_map.items():
                future = executor.submit(
                    _wrapped_upload,
                    client=client,
                    mission_id=mission_id,
                    filename=name,
                    path=path,
                    verbose=verbose,
                    progress=pbar,
                )
                futures[path] = future

        errors = []
        total_size = 0
        for path, future in futures.items():
            try:
                size = future.result()
                total_size += size / 1024 / 1024  # convert to MB
            except Exception as e:
                logger.error(format_traceback(e))
                errors.append(e)
                print(
                    format_error(f"error uploading {path}", e, verbose=verbose),
                    file=sys.stderr,
                )

        time = monotonic() - start
        c = Console(file=sys.stderr)
        c.print(f"upload took {time:.2f} seconds")
        c.print(f"total size: {int(total_size)} MB")
        c.print(f"average speed: {total_size / time:.2f} MB/s")

        if errors:
            raise UploadFailed(f"got unhandled errors: {errors} during upload")
