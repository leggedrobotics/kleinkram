import fnmatch
import os
import threading

import httpx
import tqdm
from rich import print
import queue

from .consts import API_URL
from typing import Dict


def list_files_recursive(path, recursive: bool, pattern: str, depth: int = 0):
    files = []
    res = {}
    try:
        entries = os.listdir(path)
    except PermissionError:
        return False

    for entry in entries:
        full_path = os.path.join(path, entry)
        if os.path.isdir(full_path):
            if recursive:
                sub_res = list_files_recursive(full_path, recursive, pattern, depth + 1)
                if sub_res:
                    res[full_path.split('/')[-1]] = sub_res
        elif fnmatch.fnmatch(entry, pattern):
            files.append(entry)

    if len(files) > 0:
        res[''] = files
    if len(res.keys()) > 0:
        return res
    return None

def printFiles(files, depth: int = 0):
    for key in files.keys():
        if key == "":
            for file in files[key]:
                print("  " * depth + "- " + file)
        else:
            print("  " * depth + "- " + key)
            printFiles(files[key], depth + 1)

def convertFilesStructure(files, currentDir: str = ""):
    res = []
    for key in files.keys():
        if key == "":
            for file in files[key]:
                res.append(currentDir + file)
        else:
            res.extend(convertFilesStructure(files[key], currentDir + key + "/"))
    return res

def uploadFiles(files: Dict[str, str], paths: Dict[str,str], nrThreads: int):
    _queue = queue.Queue()
    for file in files.items():
        _queue.put(file)
    threads = []
    pbar = tqdm.tqdm(total=len(files.items()))
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
            with open(filepath, "rb") as f:
                file_data = f.read()
                headers = {
                    'Content-Type': 'application/octet-stream'
                }

                resp = httpx.put(url, content=file_data, headers=headers)
                resp.raise_for_status()
                httpx.post(API_URL + "/queue/confirmUpload", json={"filename": filename})
                pbar.update(1)

        except queue.Empty:
            break


if __name__ == '__main__':
    path = '~/Downloads/dodo_mission_2024_02_08-20240408T074313Z-004/dodo_mission_2024_02_08'
    path = os.path.expanduser(path)
    files = list_files_recursive(
        path,
        True,
        pattern='*.bag')
    printFiles(files)
    print(convertFilesStructure(files))