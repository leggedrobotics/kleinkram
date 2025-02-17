from __future__ import annotations

import os
import secrets
import shutil
import time
from pathlib import Path

import pytest
from rich.console import Console
from rich.text import Text

from kleinkram.api.routes import _get_api_version

VERBOSE = True

CLI = "klein"
PROJECT_NAME = "automated-testing"
DATA_PATH = Path(__file__).parent.parent / "data" / "testing"


@pytest.fixture(scope="session")
def api():
    try:
        _get_api_version()
        return True
    except Exception:
        print("API is not available")
        return False


def run_cmd(command, *, verbose=VERBOSE):
    msg = ("\n", "#" * 50, "\n\n", "running command:", Text(command, style="bold"))
    Console().print(*msg)

    if not verbose:
        command += ">/dev/null 2>&1"
    ret = os.system(command)
    Console().print("got return code:", ret, style="bold red")
    return ret


@pytest.mark.slow
def test_upload_verify_update_download_mission(project, tmp_path, api):
    assert api

    file_names = list(DATA_PATH.glob("*.bag"))

    mission_name = secrets.token_hex(8)
    upload = f"{CLI} upload -p {project.name} -m {mission_name} --create {DATA_PATH.absolute()}/*.bag"
    verify = (
        f"{CLI} verify -p {project.name} -m {mission_name} {DATA_PATH.absolute()}/*.bag"
    )
    # update = f"{CLI} mission update -p {project.name} -m {mission_name} --metadata {DATA_PATH.absolute()}/metadata.yaml"
    download = f"{CLI} download -p {project.name} -m {mission_name} --dest {tmp_path.absolute()}"
    delete_file = f"{CLI} file delete -p {project.name} -m {mission_name} -f {file_names[0].name} -y"

    assert run_cmd(upload) == 0
    assert run_cmd(verify) == 0
    # assert run_cmd(update) == 0
    assert run_cmd(download) == 0

    assert run_cmd(delete_file) == 0


@pytest.mark.slow
def test_list_files(project, mission, api):
    assert api
    assert run_cmd(f"{CLI} list files -p {project.name}") == 0
    assert run_cmd(f"{CLI} list files -p {project.name} -m {mission.name}") == 0
    assert run_cmd(f"{CLI} list files") == 0
    assert run_cmd(f"{CLI} list files -p {mission.name}") == 0
    assert run_cmd(f'{CLI} list files -p "*" -m "*" "*"') == 0


@pytest.mark.slow
def test_list_missions(api, project, mission):
    assert api

    assert run_cmd(f"{CLI} list missions -p {project.name} {mission.name}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.name} {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.name} {mission.id}") == 0
    assert run_cmd(f"{CLI} list missions {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions {mission.id}") == 0
    assert run_cmd(f"{CLI} list missions {mission.name}") == 0

    assert run_cmd(f"{CLI} list missions -p {project.name}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.id}") == 0
    assert run_cmd(f"{CLI} list missions -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions") == 0
    assert run_cmd(f'{CLI} list missions -p "*" "*"') == 0


@pytest.mark.slow
def test_list_projects(api, project):
    assert api
    assert run_cmd(f"{CLI} list projects") == 0
    assert run_cmd(f"{CLI} list projects {project.name}") == 0
    assert run_cmd(f"{CLI} list projects {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list projects {project.id}") == 0
    assert run_cmd(f'{CLI} list projects "*"') == 0
