import glob
import os
import queue
import re
import sys
import threading
from datetime import datetime
from functools import partial

import boto3
import tqdm
import typer
from boto3.s3.transfer import TransferConfig
from botocore.config import Config
from botocore.utils import calculate_md5
from rich import print
from rich.console import Console
from typing_extensions import Dict

from kleinkram.api_client import AuthenticatedClient


class TransferCallback:
    """
    Handle callbacks from the transfer manager.

    The transfer manager periodically calls the __call__ method throughout
    the upload process so that it can take action, such as displaying progress
    to the user and collecting data about the transfer.
    """

    def __init__(self):
        """
        Initialize the TransferCallback.

        This initializes an empty dictionary to hold progress bars for each file.
        """
        self._lock = threading.Lock()
        self.file_progress = {}

    def add_file(self, file_id, target_size):
        """
        Add a new file to track.

        :param file_id: A unique identifier for the file (e.g., file name or ID).
        :param target_size: The total size of the file being transferred.
        """
        with self._lock:
            tqdm_instance = tqdm.tqdm(
                total=target_size,
                unit="B",
                unit_scale=True,
                desc=f"Uploading {file_id}",
            )
            self.file_progress[file_id] = {
                "tqdm": tqdm_instance,
                "total_transferred": 0,
            }

    def __call__(self, file_id, bytes_transferred):
        """
        The callback method that is called by the transfer manager.

        Display progress during file transfer and collect per-thread transfer
        data. This method can be called by multiple threads, so shared instance
        data is protected by a thread lock.

        :param file_id: The identifier of the file being transferred.
        :param bytes_transferred: The number of bytes transferred in this call.
        """
        with self._lock:
            if file_id in self.file_progress:
                progress = self.file_progress[file_id]
                progress["total_transferred"] += bytes_transferred

                # Update tqdm progress bar
                progress["tqdm"].update(bytes_transferred)

    def close(self):
        """Close all tqdm progress bars."""
        with self._lock:
            for progress in self.file_progress.values():
                progress["tqdm"].close()


def create_transfer_callback(callback_instance, file_id):
    """
    Factory function to create a partial function for TransferCallback.
    :param callback_instance: Instance of TransferCallback.
    :param file_id: The unique identifier for the file.
    :return: A callable that can be passed as a callback to boto3's upload_file method.
    """
    return partial(callback_instance.__call__, file_id)


def expand_and_match(path_pattern):
    expanded_path = os.path.expanduser(path_pattern)
    expanded_path = os.path.expandvars(expanded_path)

    normalized_path = os.path.normpath(expanded_path)

    if "**" in normalized_path:
        file_list = glob.glob(normalized_path, recursive=True)
    else:
        file_list = glob.glob(normalized_path)

    return file_list


def uploadFiles(
    files_with_access: Dict[str, object], paths: Dict[str, str], nrThreads: int
):
    client = AuthenticatedClient()

    api_endpoint = client.tokenfile.endpoint
    if api_endpoint == "http://localhost:3000":
        minio_endpoint = "http://localhost:9000"
    else:
        minio_endpoint = api_endpoint.replace("api", "minio")

    _queue = queue.Queue()
    for file_with_access in files_with_access:
        _queue.put((file_with_access, str(paths[file_with_access["fileName"]])))

    threads = []
    transfer_callback = TransferCallback()

    for i in range(nrThreads):
        thread = threading.Thread(
            target=uploadFile,
            args=(_queue, minio_endpoint, transfer_callback),
        )
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()


def uploadFile(
    _queue: queue.Queue,
    minio_endpoint: str,
    transfer_callback: TransferCallback,
):
    config = Config(retries={"max_attempts": 10, "mode": "standard"})

    while True:
        try:
            file_with_access, filepath = _queue.get(timeout=3)

            if "error" in file_with_access and (
                file_with_access["error"] is not None or file_with_access["error"] != ""
            ):
                console = Console(file=sys.stderr, style="red", highlight=False)
                console.print(
                    f"Error uploading file: {file_with_access['fileName']} ({filepath}): {file_with_access['error']}"
                )
                _queue.task_done()
                continue

            access_key = file_with_access["accessCredentials"]["accessKey"]
            secret_key = file_with_access["accessCredentials"]["secretKey"]
            session_token = file_with_access["accessCredentials"]["sessionToken"]

            session = boto3.Session(
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
                aws_session_token=session_token,
            )

            s3 = session.resource("s3", endpoint_url=minio_endpoint, config=config)

            fileu_uid = file_with_access["fileUUID"]
            bucket = file_with_access["bucket"]

            transfer_config = TransferConfig(
                multipart_chunksize=10 * 1024 * 1024,
                max_concurrency=5,
            )
            with open(filepath, "rb") as f:
                md5_checksum = calculate_md5(f)
                file_size = os.path.getsize(filepath)
                transfer_callback.add_file(filepath, file_size)
                callback_function = create_transfer_callback(
                    transfer_callback, filepath
                )
                s3.Bucket(bucket).upload_file(
                    filepath,
                    fileu_uid,
                    Config=transfer_config,
                    Callback=callback_function,
                )

                client = AuthenticatedClient()
                res = client.post(
                    "/queue/confirmUpload",
                    json={"uuid": fileu_uid, "md5": md5_checksum},
                )
                res.raise_for_status()
            _queue.task_done()
        except queue.Empty:
            break
        except Exception as e:
            print("Error uploading file: " + filepath)
            print(e)
            _queue.task_done()


def canUploadMission(client: AuthenticatedClient, project_uuid: str):
    permissions = client.get("/user/permissions")
    permissions.raise_for_status()
    permissions_json = permissions.json()
    for_project = filter(
        lambda x: x["uuid"] == project_uuid, permissions_json["projects"]
    )
    max_for_project = max(map(lambda x: x["access"], for_project))
    return max_for_project >= 10


def promptForTags(setTags: Dict[str, str], requiredTags: Dict[str, str]):
    for required_tag in requiredTags:
        if required_tag["name"] not in setTags:
            while True:
                if required_tag["datatype"] in ["LOCATION", "STRING", "LINK"]:
                    tag_value = typer.prompt(
                        "Provide value for required tag " + required_tag["name"]
                    )
                    if tag_value != "":
                        break
                elif required_tag["datatype"] == "BOOLEAN":
                    tag_value = typer.confirm(
                        "Provide (y/N) for required tag " + required_tag["name"]
                    )
                    break
                elif required_tag["datatype"] == "NUMBER":
                    tag_value = typer.prompt(
                        "Provide number for required tag " + required_tag["name"]
                    )
                    try:
                        tag_value = float(tag_value)
                        break
                    except ValueError:
                        typer.echo("Invalid number format. Please provide a number.")
                elif required_tag["datatype"] == "DATE":
                    tag_value = typer.prompt(
                        "Provide date for required tag " + required_tag["name"]
                    )
                    try:
                        tag_value = datetime.strptime(tag_value, "%Y-%m-%d %H:%M:%S")
                        break
                    except ValueError:
                        print("Invalid date format. Please use 'YYYY-MM-DD HH:MM:SS'")

            setTags[required_tag["uuid"]] = tag_value


def is_valid_UUIDv4(uuid: str) -> bool:
    has_correct_length = len(uuid) == 36

    # is UUID4
    uuid_regex = (
        "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
    )
    is_valid_uuid = re.match(uuid_regex, uuid)

    return has_correct_length and is_valid_uuid


if __name__ == "__main__":
    res = expand_and_match(
        "~/Downloads/dodo_mission_2024_02_08-20240408T074313Z-003/**.bag"
    )
    print(res)
