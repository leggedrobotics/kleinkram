from __future__ import annotations

import os
import time
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
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.errors import MissionNotFound
from kleinkram.models import FileVerificationStatus
from tests.backend_fixtures import DATA_FILES


def _create_test_template(client: AuthenticatedClient, *, name: str, description: str) -> kleinkram.models.ActionTemplate:
    template_id = kleinkram.core.create_template(
        client,
        name=name,
        description=description,
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=60,
        access_rights=0,
        command="echo hello",
    )
    return kleinkram.api.routes.get_template(client, template_id)


@pytest.mark.slow
def test_upload_create(project):
    mission_name = token_hex(8)
    mission_query = MissionQuery(patterns=[mission_name], project_query=ProjectQuery(ids=[project.id]))

    client = AuthenticatedClient()
    kleinkram.core.upload(client=client, query=mission_query, file_paths=DATA_FILES, create=True)

    mission = list_missions(mission_names=[mission_name])[0]
    assert mission.project_id == project.id
    assert mission.name == mission_name

    files = list_files(mission_ids=[mission.id])
    assert set([file.name for file in files if file.name.endswith(".bag")]) == set([file.name for file in DATA_FILES])


@pytest.mark.slow
def test_upload_no_create(project):
    mission_name = token_hex(8)
    mission_query = MissionQuery(patterns=[mission_name], project_query=ProjectQuery(ids=[project.id]))

    client = AuthenticatedClient()
    with pytest.raises(MissionNotFound):
        kleinkram.core.upload(client=client, query=mission_query, file_paths=DATA_FILES, create=False)


@pytest.mark.slow
def test_upload_to_existing_mission(empty_mission):
    mission_query = MissionQuery(ids=[empty_mission.id])

    client = AuthenticatedClient()
    kleinkram.core.upload(client=client, query=mission_query, file_paths=DATA_FILES)

    files = list_files(mission_ids=[empty_mission.id])
    assert set([file.name for file in files if file.name.endswith(".bag")]) == set([file.name for file in DATA_FILES])


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
    n_files_after_delete = len(list_files(mission_ids=[mission.id], file_names=["*.bag"]))
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
    kleinkram.core.create_mission(client, project.id, mission_name)

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
    kleinkram.core.update_project(client=client, project_id=project.id, new_name=new_name, description="new desc")

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
def test_download_nested(project, mission, tmp_path):
    client = AuthenticatedClient()

    query = FileQuery(mission_query=MissionQuery(ids=[mission.id]), patterns=["*.bag"])
    kleinkram.core.download(client=client, query=query, base_dir=tmp_path, nested=True)
    files = list_files(mission_ids=[mission.id], file_names=["*.bag"])

    project_dir = tmp_path / project.name
    mission_dir = project_dir / mission.name

    assert mission_dir.exists()
    assert mission_dir.is_dir()

    assert set([f.name for f in mission_dir.iterdir()]) == set([f.name for f in files])

    for file in files:
        assert (mission_dir / file.name).stat().st_size == file.size


@pytest.mark.slow
def test_verify(mission):
    client = AuthenticatedClient()
    query = MissionQuery(ids=[mission.id])

    verify_status = kleinkram.core.verify(client=client, query=query, file_paths=DATA_FILES, skip_hash=True)

    assert all(status == FileVerificationStatus.UPLOADED for status in verify_status.values())


@pytest.mark.slow
def test_update_file():
    client = AuthenticatedClient()
    with pytest.raises(NotImplementedError):
        kleinkram.core.update_file(client=client, file_id=uuid4())


@pytest.mark.slow
def test_templates_create_version_list_revisions_delete():
    client = AuthenticatedClient()
    template_name = f"tmpl-{token_hex(6)}"
    description = "test template"

    template = _create_test_template(client, name=template_name, description=description)
    assert template.name == template_name
    assert template.description == description

    new_template_id = kleinkram.core.create_template_version(
        client,
        template_id=template.uuid,
        description="updated description",
    )

    revisions = list(kleinkram.api.routes.get_template_revisions(client, template_id=template.uuid))
    revision_ids = {rev.uuid for rev in revisions}
    assert template.uuid in revision_ids
    assert new_template_id in revision_ids

    latest_templates = kleinkram.core.list_templates(client, latest_only=True)
    latest_for_name = [t for t in latest_templates if t.name == template_name]
    assert len(latest_for_name) == 1
    assert latest_for_name[0].uuid == new_template_id

    archived = kleinkram.core.delete_template(client=client, template_id=new_template_id)
    assert archived is False


@pytest.mark.slow
def test_launch_execution_and_list(empty_mission):
    client = AuthenticatedClient()
    template_name = f"tmpl-{token_hex(6)}"
    template = _create_test_template(client, name=template_name, description="exec template")

    execution_id = kleinkram.core.launch_execution(
        client=client,
        mission_query=MissionQuery(ids=[empty_mission.id]),
        template=template.uuid,
    )

    execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
    assert execution.mission_id == empty_mission.id
    assert execution.template_id == template.uuid

    found = False
    for _ in range(5):
        executions = list(kleinkram.api.routes.get_executions(client, query=ExecutionQuery(template_name=template_name)))
        if any(e.uuid == execution_id for e in executions):
            found = True
            break
        time.sleep(1)

    assert found is True

    archived = kleinkram.core.delete_template(client=client, template_id=template.uuid)
    assert archived is True
