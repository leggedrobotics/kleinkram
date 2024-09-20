import glob
import os
import queue
import threading
from datetime import datetime
from functools import partial

import typer
from botocore.config import Config
from typing_extensions import Dict
import boto3

import tqdm
from boto3.s3.transfer import TransferConfig
from botocore.client import BaseClient
from rich import print

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


def uploadFiles(files: Dict[str, str], credentials: Dict[str, str], nrThreads: int):
    client = AuthenticatedClient()

    session = boto3.Session(
        aws_access_key_id=credentials["accessKey"],
        aws_secret_access_key=credentials["secretKey"],
        aws_session_token=credentials["sessionToken"],
    )
    api_endpoint = client.tokenfile.endpoint
    if api_endpoint == "http://localhost:3000":
        minio_endpoint = "http://localhost:9000"
    else:
        minio_endpoint = api_endpoint.replace("api", "minio")

    config = Config(retries={"max_attempts": 10, "mode": "standard"})
    s3 = session.resource("s3", endpoint_url=minio_endpoint, config=config)

    _queue = queue.Queue()
    for file in files.items():
        _queue.put(file)
    threads = []
    transferCallback = TransferCallback()

    for i in range(nrThreads):
        thread = threading.Thread(
            target=uploadFile, args=(_queue, s3, transferCallback)
        )
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()


def uploadFile(_queue: queue.Queue, s3: BaseClient, transferCallback: TransferCallback):
    while True:
        try:
            filename, _file = _queue.get(timeout=3)
            queueUUID = _file["queueUUID"]
            filepath = _file["filepath"]
            bucket = _file["bucket"]
            target_location = _file["location"]
            config = TransferConfig(
                multipart_chunksize=10 * 1024 * 1024, max_concurrency=5
            )
            with open(filepath, "rb") as f:
                size = os.path.getsize(filepath)
                transferCallback.add_file(filename, size)
                callback_function = create_transfer_callback(transferCallback, filename)
                s3.Bucket(bucket).upload_file(
                    filepath, target_location, Config=config, Callback=callback_function
                )

                client = AuthenticatedClient()
                res = client.post("/queue/confirmUpload", json={"uuid": queueUUID})
                res.raise_for_status()
            _queue.task_done()
        except queue.Empty:
            break
        except Exception as e:
            print(f"Error uploading {filename}: {e}")
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


if __name__ == "__main__":
    res = expand_and_match(
        "~/Downloads/dodo_mission_2024_02_08-20240408T074313Z-003/**.bag"
    )
    print(res)
