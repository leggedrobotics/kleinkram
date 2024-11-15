from __future__ import annotations

import os
import secrets

from rich.console import Console


TESTING_PROJECT = "testing-dominique"
TESTING_FILES = "./data/large/*.bag"
TESTING_DEST = "./data/tmp"
TESTING_DOWNLOAD = "download"


def upload_files() -> None:
    console = Console()
    mission_name = secrets.token_hex(16)
    console.print(
        f"testing upload of files for mission {mission_name}...", style="bold green"
    )

    cmd = f"kleinkram upload -p {TESTING_PROJECT} -m {mission_name} --create {TESTING_FILES}"
    console.print(f"running command: {cmd}", style="bold green")
    os.system(cmd)


def verify_files() -> None:
    console = Console()
    mission_name = secrets.token_hex(16)
    console.print(
        f"testing verification of files for mission {mission_name}...",
        style="bold green",
    )

    cmd = f"kleinkram verify -p {TESTING_PROJECT} -m {mission_name} {TESTING_FILES}"
    console.print(f"running command: {cmd}", style="bold green")
    os.system(cmd)


def download_files() -> None:
    console = Console()
    console.print(
        f"testing download of files for mission {TESTING_DOWNLOAD}...",
        style="bold green",
    )

    cmd = f"kleinkram download -p {TESTING_PROJECT} -m {TESTING_DOWNLOAD} --dest {TESTING_DEST}"
    console.print(f"running command: {cmd}", style="bold green")
    os.system(cmd)


if __name__ == "__main__":
    upload_files()
    verify_files()
    download_files()
