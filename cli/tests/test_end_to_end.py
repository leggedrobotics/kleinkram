from __future__ import annotations

import os
import secrets
import shutil
from pathlib import Path

import pytest
from kleinkram.api.routes import _get_api_version
from rich.console import Console
from rich.text import Text

VERBOSE = True

CLI = "klein"
PROJECT_NAME = "automated-testing"

DATA_DIR = Path(__file__).parent.parent / "data" / "testing"
_IN_DIR = DATA_DIR / "in"
_OUT_DIR = DATA_DIR / "out"


@pytest.fixture(scope="session")
def api():
    try:
        _get_api_version()
        return True
    except Exception:
        print("API is not available")
        return False


@pytest.fixture(scope="session")
def in_dir():
    return _IN_DIR


@pytest.fixture(scope="session")
def out_dir():
    try:
        _OUT_DIR.mkdir(exist_ok=True)
        yield _OUT_DIR
    finally:
        shutil.rmtree(_OUT_DIR)


@pytest.fixture(scope="session")
def name():
    return secrets.token_hex(8)


def run_cmd(command, *, verbose=VERBOSE):
    msg = ("\n", "#" * 50, "\n\n", "running command:", Text(command, style="bold"))
    Console().print(*msg)

    if not verbose:
        command += ">/dev/null 2>&1"
    ret = os.system(command)
    Console().print("got return code:", ret, style="bold red")
    return ret


@pytest.mark.slow
def test_upload_verify_update_download_mission(name, in_dir, out_dir, api):
    assert api

    upload = (
        f"{CLI} upload -p {PROJECT_NAME} -m {name} --create {in_dir.absolute()}/*.bag"
    )
    verify = f"{CLI} verify -p {PROJECT_NAME} -m {name} {in_dir.absolute()}/*.bag"
    update = f"{CLI} mission update -p {PROJECT_NAME} -m {name} --metadata {in_dir.absolute()}/metadata.yaml"
    download = f"{CLI} download -p {PROJECT_NAME} -m {name} --dest {out_dir.absolute()}"

    assert run_cmd(upload) == 0
    assert run_cmd(verify) == 0
    assert run_cmd(update) == 0
    assert run_cmd(download) == 0


@pytest.mark.slow
def test_list_files(api):
    assert api
    assert run_cmd(f"{CLI} list files -p {PROJECT_NAME}") == 0
    assert run_cmd(f"{CLI} list files -p {PROJECT_NAME} -m {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list files") == 0
    assert run_cmd(f"{CLI} list files -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f'{CLI} list files -p "*" -m "*" "*"') == 0


@pytest.mark.slow
def test_list_missions(api):
    assert api
    assert run_cmd(f"{CLI} list missions -p {PROJECT_NAME}") == 0
    assert run_cmd(f"{CLI} list missions -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions") == 0
    assert run_cmd(f'{CLI} list missions -p "*" "*"') == 0


@pytest.mark.slow
def test_list_projects(api):
    assert api
    assert run_cmd(f"{CLI} list projects") == 0
    assert run_cmd(f"{CLI} list projects {PROJECT_NAME}") == 0
    assert run_cmd(f"{CLI} list projects {secrets.token_hex(8)}") == 0
    assert run_cmd(f'{CLI} list projects "*"') == 0
