import fnmatch
import math
import os
import threading
import glob

import httpx
import tqdm
from rich import print
import queue

from .consts import API_URL
from typing import Dict


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
            chunk_size = 4096 * 512
            with open(filepath, "rb") as f:
                nr_chunks = math.ceil(os.path.getsize(filepath) / chunk_size)
                update_size = math.floor(1000000 / nr_chunks) / 10000

                print(f"Uploading: {filename}")
                while chunk := f.read(chunk_size):  # Read in chunks of 4KB
                    resp = httpx.put(url, content=chunk, headers=headers, timeout=60.0)
                    resp.raise_for_status()
                    pbar.update(update_size)

                httpx.post(
                    API_URL + "/queue/confirmUpload", json={"filename": filename}
                )

        except queue.Empty:
            break


if __name__ == "__main__":
    res = expand_and_match(
        "~/Downloads/dodo_mission_2024_02_08-20240408T074313Z-003/**.bag"
    )
    print(res)
