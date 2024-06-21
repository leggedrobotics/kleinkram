import fnmatch
import math
import os
import threading
import glob

import httpx
import tqdm
from rich import print
import queue

from typing import Dict

from .auth import client


def expand_and_match(path_pattern):
    expanded_path = os.path.expanduser(path_pattern)
    expanded_path = os.path.expandvars(expanded_path)

    normalized_path = os.path.normpath(expanded_path)

    if "**" in normalized_path:
        file_list = glob.glob(normalized_path, recursive=True)
    else:
        file_list = glob.glob(normalized_path)

    return file_list


def uploadFiles(files: Dict[str, str], paths: Dict[str, str], nrThreads: int):
    _queue = queue.Queue()
    for file in files.items():
        _queue.put(file)
    threads = []
    pbar = tqdm.tqdm(total=len(files.items()) * 100)
    for i in range(nrThreads):
        thread = threading.Thread(target=uploadFile, args=(_queue, paths, pbar))
        thread.start()
        threads.append(thread)
    for thread in threads:
        thread.join()


def uploadFile(_queue: queue.Queue, paths: Dict[str, str], pbar: tqdm):
    while True:
        try:
            filename, url = _queue.get(timeout=3)
            filepath = paths[filename]
            headers = {"Content-Type": "application/octet-stream"}
            with open(filepath, "rb") as f:
                with httpx.Client() as cli:
                    # Using PUT method directly for the upload
                    response = cli.put(url, content=f, headers=headers)
                    if response.status_code == 200:
                        pbar.update(100)  # Update progress for each file
                        client.post("/queue/confirmUpload", json={"filename": filename})
                    else:
                        print(f"Failed to upload {filename}. HTTP status: {response.status_code}")
            _queue.task_done()
        except queue.Empty:
            break
        except Exception as e:
            print(f"Error uploading {filename}: {e}")
            _queue.task_done()


if __name__ == "__main__":
    res = expand_and_match(
        "~/Downloads/dodo_mission_2024_02_08-20240408T074313Z-003/**.bag"
    )
    print(res)
