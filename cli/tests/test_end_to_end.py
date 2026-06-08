from __future__ import annotations

import os
import secrets
import shutil
import time
from pathlib import Path

import pytest
from rich.console import Console
from rich.text import Text

import kleinkram.wrappers
from kleinkram.api.routes import _get_api_version

VERBOSE = True

CLI = "klein"
PROJECT_NAME = "automated-testing"
DATA_PATH = Path(__file__).parent / "data"


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
    verify = f"{CLI} verify -p {project.name} -m {mission_name} {DATA_PATH.absolute()}/*.bag"
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
    # Legacy commands
    assert run_cmd(f"{CLI} list files -p {project.name}") == 0
    assert run_cmd(f"{CLI} list files -p {project.name} -m {mission.name}") == 0
    assert run_cmd(f"{CLI} list files") == 0
    assert run_cmd(f"{CLI} list files -p {project.name}") == 0
    assert run_cmd(f'{CLI} list files -p "*" -m "*" "*"') == 0

    # New commands
    assert run_cmd(f"{CLI} file list -p {project.name}") == 0
    assert run_cmd(f"{CLI} file list -p {project.name} -m {mission.name}") == 0
    assert run_cmd(f"{CLI} file list") == 0
    assert run_cmd(f"{CLI} file list -p {project.name}") == 0
    assert run_cmd(f'{CLI} file list -p "*" -m "*" "*"') == 0


@pytest.mark.slow
def test_list_missions(api, project, mission):
    assert api

    # Legacy commands
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

    # New commands
    assert run_cmd(f"{CLI} mission list -p {project.name} {mission.name}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.name} {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.name} {mission.id}") == 0
    assert run_cmd(f"{CLI} mission list {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list {mission.id}") == 0
    assert run_cmd(f"{CLI} mission list {mission.name}") == 0

    assert run_cmd(f"{CLI} mission list -p {project.name}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.id}") == 0
    assert run_cmd(f"{CLI} mission list -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list") == 0
    assert run_cmd(f'{CLI} mission list -p "*" "*"') == 0


@pytest.mark.slow
def test_list_projects(api, project):
    assert api
    # Legacy commands
    assert run_cmd(f"{CLI} list projects") == 0
    assert run_cmd(f"{CLI} list projects {project.name}") == 0
    assert run_cmd(f"{CLI} list projects {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list projects {project.id}") == 0
    assert run_cmd(f'{CLI} list projects "*"') == 0

    # New commands
    assert run_cmd(f"{CLI} project list") == 0
    assert run_cmd(f"{CLI} project list {project.name}") == 0
    assert run_cmd(f"{CLI} project list {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} project list {project.id}") == 0
    assert run_cmd(f'{CLI} project list "*"') == 0


@pytest.mark.slow
def test_trigger_cli_operations(empty_mission, action_template, api):
    """E2E Test to verify CLI trigger commands process flags and return correct exit codes."""
    assert api

    trigger_name = f"trig-cli-{secrets.token_hex(6)}"
    create_cmd = (
        f"{CLI} triggers create "
        f"--name {trigger_name} "
        f"--template {action_template.uuid} "
        f"--mission {empty_mission.id} "
        f"--type FILE "
        f"--file-patterns '*.bag' "
        f"--file-events UPLOAD"
    )
    assert run_cmd(create_cmd) == 0

    list_cmd = f"{CLI} triggers list --mission {empty_mission.id}"
    assert run_cmd(list_cmd) == 0

    fail_cmd = (
        f"{CLI} triggers create "
        f"--name {trigger_name}-fail "
        f"--template {action_template.uuid} "
        f"--mission {empty_mission.id} "
        f"--type FILE"
    )
    assert run_cmd(fail_cmd) != 0

    triggers = kleinkram.wrappers.list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers) == 1
    trigger_uuid = triggers[0].uuid

    info_cmd = f"{CLI} triggers info {trigger_uuid}"
    assert run_cmd(info_cmd) == 0

    update_cmd = f"{CLI} triggers update {trigger_uuid} --description 'updated via E2E CLI'"
    assert run_cmd(update_cmd) == 0

    delete_cmd = f"{CLI} triggers delete {trigger_uuid}"
    assert run_cmd(delete_cmd) == 0
