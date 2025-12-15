from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from secrets import token_hex

import pytest

from kleinkram import create_mission
from kleinkram import create_project
from kleinkram import delete_project
from kleinkram import list_missions
from kleinkram import list_projects
from kleinkram import upload

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


@pytest.fixture(scope="session")
def project():
    project_name = token_hex(8)

    create_project(project_name, description="This is a test project")
    project = list_projects(project_names=[project_name])[0]

    yield project

    time.sleep(WAIT_BEFORE_DELETION)
    delete_project(project.id)


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


@pytest.fixture(scope="session", autouse=True)
def auto_login():
    """
    Automatically logs in using the CLI before running any tests.
    """
    try:
        # Run: python3 -m kleinkram login --user 1
        result = subprocess.run(
            [sys.executable, "-m", "kleinkram", "login", "--user", "1"],
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
