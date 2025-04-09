from __future__ import annotations

from secrets import token_hex
from uuid import uuid4

import pytest

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
from kleinkram import list_files
from kleinkram import list_missions
from kleinkram import list_projects
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.errors import MissionNotFound
from kleinkram.models import FileVerificationStatus
from testing.backend_fixtures import DATA_FILES


@pytest.mark.slow
def test_upload_create(project):
    mission_name = token_hex(8)
    mission_query = MissionQuery(
        patterns=[mission_name], project_query=ProjectQuery(ids=[project.id])
    )

    client = AuthenticatedClient()
    kleinkram.core.upload(
        client=client, query=mission_query, file_paths=DATA_FILES, create=True
    )

    mission = list_missions(mission_names=[mission_name])[0]
    assert mission.project_id == project.id
    assert mission.name == mission_name

    files = list_files(mission_ids=[mission.id])
    assert set([file.name for file in files if file.name.endswith(".bag")]) == set(
        [file.name for file in DATA_FILES]
    )


@pytest.mark.slow
def test_upload_no_create(project):
    mission_name = token_hex(8)
    mission_query = MissionQuery(
        patterns=[mission_name], project_query=ProjectQuery(ids=[project.id])
    )

    client = AuthenticatedClient()
    with pytest.raises(MissionNotFound):
        kleinkram.core.upload(
            client=client, query=mission_query, file_paths=DATA_FILES, create=False
        )


@pytest.mark.slow
def test_upload_to_existing_mission(empty_mission):
    mission_query = MissionQuery(ids=[empty_mission.id])

    client = AuthenticatedClient()
    kleinkram.core.upload(client=client, query=mission_query, file_paths=DATA_FILES)

    files = list_files(mission_ids=[empty_mission.id])
    assert set([file.name for file in files if file.name.endswith(".bag")]) == set(
        [file.name for file in DATA_FILES]
    )


@pytest.mark.slow
def test_delete_existing_files(mission):
    client = AuthenticatedClient()
    files = list_files(mission_ids=[mission.id], file_names=["*.bag"])
    kleinkram.core.delete_files(client=client, file_ids=[f.id for f in files])
    assert not list_files(mission_ids=[mission.id], file_names=["*.bag"])


@pytest.mark.slow
def test_delete_working_as_expected_when_passing_empty_list(mission):
    client = AuthenticatedClient()

    # we need to filter by *.bag to not get flakyness due to conversion
    n_files = len(list_files(mission_ids=[mission.id], file_names=["*.bag"]))
    kleinkram.core.delete_files(client=client, file_ids=[])
    n_files_after_delete = len(
        list_files(mission_ids=[mission.id], file_names=["*.bag"])
    )
    assert n_files == n_files_after_delete


@pytest.mark.slow
def test_delete_non_existing_files():
    client = AuthenticatedClient()

    with pytest.raises(kleinkram.errors.FileNotFound):
        kleinkram.core.delete_files(client=client, file_ids=[uuid4()])


@pytest.mark.slow
def test_create_update_delete_mission(project):
    mission_name = token_hex(8)

    client = AuthenticatedClient()
    kleinkram.api.routes._create_mission(client, project.id, mission_name)

    mission = list_missions(mission_names=[mission_name])[0]

    assert mission.project_id == project.id
    assert mission.name == mission_name

    assert list_files(mission_ids=[mission.id]) == []

    # TODO test update, for this we would need to add metadata types to the backend

    kleinkram.core.delete_mission(client=client, mission_id=mission.id)


@pytest.mark.slow
def test_create_update_delete_project():
    project_name = token_hex(8)

    client = AuthenticatedClient()
    project_id = kleinkram.api.routes._create_project(client, project_name, "test")
    project = list_projects(project_ids=[project_id])[0]

    assert list_missions(project_ids=[project.id]) == []
    assert list_files(project_ids=[project.id]) == []

    assert project.name == project_name
    assert project.description == "test"

    new_name = token_hex(8)
    kleinkram.core.update_project(
        client=client, project_id=project.id, new_name=new_name, description="new desc"
    )

    project = list_projects(project_ids=[project.id])[0]
    assert project.name == new_name
    assert project.description == "new desc"

    kleinkram.core.delete_project(client=client, project_id=project.id)


@pytest.mark.slow
def test_download(mission, tmp_path):
    client = AuthenticatedClient()

    query = FileQuery(mission_query=MissionQuery(ids=[mission.id]), patterns=["*.bag"])
    kleinkram.core.download(client=client, query=query, base_dir=tmp_path)
    files = list_files(mission_ids=[mission.id], file_names=["*.bag"])

    assert set([f.name for f in tmp_path.iterdir()]) == set([f.name for f in files])

    for file in files:
        assert (tmp_path / file.name).stat().st_size == file.size


@pytest.mark.slow
def test_verify(mission):
    client = AuthenticatedClient()
    query = MissionQuery(ids=[mission.id])

    verify_status = kleinkram.core.verify(
        client=client, query=query, file_paths=DATA_FILES, skip_hash=True
    )

    assert all(
        status == FileVerificationStatus.UPLOADED for status in verify_status.values()
    )


@pytest.mark.slow
def test_update_file():
    client = AuthenticatedClient()
    with pytest.raises(NotImplementedError):
        kleinkram.core.update_file(client=client, file_id=uuid4())
