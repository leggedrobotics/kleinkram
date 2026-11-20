from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from secrets import token_hex

import httpx
import pytest

from kleinkram import create_mission
from kleinkram import create_project
from kleinkram import create_template
from kleinkram import delete_project
from kleinkram import get_template
from kleinkram import list_missions
from kleinkram import list_projects
from kleinkram import upload
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.routes import get_executions
from kleinkram.core import cancel_execution

# we expect the mission files to be in this folder that is not commited to the repo
DATA_PATH = Path(__file__).parent / "data"
DATA_FILES = [
    DATA_PATH / "10_KB.bag",
    DATA_PATH / "50_KB.bag",
    DATA_PATH / "1_MB.bag",
    DATA_PATH / "17_MB.bag",
    DATA_PATH / "125_MB.bag",
]

PROJECT_DESCRIPTION = "This is a test project"


WAIT_BEFORE_DELETION = 5

# a mission can't be deleted while one of its actions still runs
UNFINISHED_EXECUTION_STATES = {"PENDING", "STARTING", "PROCESSING", "STOPPING"}
DELETION_TIMEOUT = 120


def _delete_project_after_its_executions(project_id) -> None:
    """\
    cancels the executions the tests left running, then deletes the project;
    the deletion is refused (409) until the workers have stopped their
    containers, so it is retried for a while
    """
    client = AuthenticatedClient()
    for execution in get_executions(client, ExecutionQuery(project_uuid=project_id)):
        if execution.state in UNFINISHED_EXECUTION_STATES:
            try:
                cancel_execution(client=client, execution_id=execution.uuid)
            except httpx.HTTPError:
                pass  # finished meanwhile

    deadline = time.monotonic() + DELETION_TIMEOUT
    while True:
        try:
            delete_project(project_id)
            return
        except httpx.HTTPStatusError as error:
            if error.response.status_code != 409:
                raise
            if time.monotonic() > deadline:
                left = [f"{e.uuid} {e.state}" for e in get_executions(client, ExecutionQuery(project_uuid=project_id))]
                raise AssertionError(f"project still blocked: {error.response.text}; executions: {left}") from error
            time.sleep(WAIT_BEFORE_DELETION)


@pytest.fixture(scope="session")
def project():
    project_name = token_hex(8)

    create_project(project_name, description="This is a test project")
    project = list_projects(project_names=[project_name])[0]

    yield project

    time.sleep(WAIT_BEFORE_DELETION)
    _delete_project_after_its_executions(project.id)


@pytest.fixture
def mission(project):
    mission_name = token_hex(8)
    upload(
        mission_name=mission_name,
        project_id=project.id,
        files=DATA_FILES,
        create=True,
    )
    mission = list_missions(project_ids=[project.id], mission_names=[mission_name])[0]

    yield mission


@pytest.fixture
def empty_mission(project):
    mission_name = token_hex(8)
    create_mission(mission_name, project.id, metadata={})
    mission = list_missions(project_ids=[project.id], mission_names=[mission_name])[0]

    yield mission


@pytest.fixture
def action_template(empty_mission):
    template_name = token_hex(8)
    template_id = create_template(
        name=template_name,
        description="This is a test template",
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=60,
    )
    template = get_template(template_id)

    yield template


@pytest.fixture(scope="session", autouse=True)
def auto_login():
    """
    Automatically logs in using the CLI before running any tests.
    """
    try:
        # Run: python3 -m kleinkram login --oauth-provider fake-oauth --user 1
        # (logs in to the active server, set it up first with `klein login <url>`)
        result = subprocess.run(
            [sys.executable, "-m", "kleinkram", "login", "--oauth-provider", "fake-oauth", "--user", "1"],
            cwd=str(Path(__file__).parent.parent),  # Run from cli root
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            pytest.fail(
                f"Failed to auto-login. Return code: {result.returncode}\nStdout: {result.stdout}\nStderr: {result.stderr}"
            )

    except Exception as e:
        pytest.fail(f"Failed to auto-login: {e}")
