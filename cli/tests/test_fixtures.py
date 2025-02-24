from __future__ import annotations

import pytest

from kleinkram import list_files
from kleinkram import list_missions
from kleinkram import list_projects
from testing.backend_fixtures import DATA_FILES
from testing.backend_fixtures import PROJECT_DESCRIPTION


@pytest.mark.slow
def test_project_fixture(project):
    assert list_projects(project_ids=[project.id])[0].id == project.id
    assert project.description == PROJECT_DESCRIPTION


@pytest.mark.slow
def test_mission_fixture(mission, project):
    assert mission.project_id == project.id
    assert list_missions(mission_ids=[mission.id])[0].id == mission.id

    files = list_files(mission_ids=[mission.id])

    assert set([file.name for file in files if file.name.endswith(".bag")]) == set(
        [file.name for file in DATA_FILES]
    )


@pytest.mark.slow
def test_empty_mission_fixture(empty_mission, project):
    assert empty_mission.project_id == project.id
    assert list_missions(mission_ids=[empty_mission.id])[0].id == empty_mission.id
    assert not list_files(mission_ids=[empty_mission.id])
