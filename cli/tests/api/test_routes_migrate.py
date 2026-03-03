from __future__ import annotations

from uuid import uuid4

import httpx
import pytest

import kleinkram.errors
from kleinkram.api.routes import _migrate_mission
from kleinkram.api.routes import _migrate_project


class DummyClient:
    def __init__(self, status_code: int = 200, json_body=None):  # noqa: ANN001
        self.status_code = status_code
        self.json_body = json_body
        self.calls = []

    def post(self, url: str, json=None):  # noqa: ANN001
        self.calls.append((url, json))
        request = httpx.Request("POST", f"http://localhost{url}")
        return httpx.Response(self.status_code, request=request, json=self.json_body)


def test_migrate_mission_uses_expected_route_and_payload():
    client = DummyClient()
    mission_id = uuid4()
    target_project_id = uuid4()

    _migrate_mission(
        client,  # type: ignore[arg-type]
        mission_id=mission_id,
        target_project_id=target_project_id,
        new_name="renamed_mission",
    )

    assert client.calls == [
        (
            "/missions/migrate",
            {
                "missionUUID": str(mission_id),
                "targetProjectUUID": str(target_project_id),
                "newName": "renamed_mission",
            },
        )
    ]


@pytest.mark.parametrize(
    "status_code,error_type",
    [
        pytest.param(401, kleinkram.errors.AccessDenied, id="401-api-key-not-allowed"),
        pytest.param(403, kleinkram.errors.AccessDenied, id="403-access-denied"),
        pytest.param(404, kleinkram.errors.MissionNotFound, id="404-mission-not-found"),
        pytest.param(400, kleinkram.errors.MissionValidationError, id="400-invalid-request"),
        pytest.param(409, kleinkram.errors.MissionExists, id="409-name-conflict"),
    ],
)
def test_migrate_mission_maps_http_errors(status_code, error_type):  # noqa: ANN001
    client = DummyClient(status_code=status_code)
    mission_id = uuid4()
    target_project_id = uuid4()

    with pytest.raises(error_type):
        _migrate_mission(
            client,  # type: ignore[arg-type]
            mission_id=mission_id,
            target_project_id=target_project_id,
        )


def test_migrate_mission_maps_project_not_found_detail():
    client = DummyClient(
        status_code=404,
        json_body={"message": "Project with UUID deadbeef not found"},
    )

    with pytest.raises(kleinkram.errors.ProjectNotFound):
        _migrate_mission(
            client,  # type: ignore[arg-type]
            mission_id=uuid4(),
            target_project_id=uuid4(),
        )


def test_migrate_project_maps_target_not_found_detail():
    source_id = uuid4()
    target_id = uuid4()
    client = DummyClient(
        status_code=404,
        json_body={"message": f"Project with UUID {target_id} not found"},
    )

    with pytest.raises(kleinkram.errors.ProjectNotFound, match=str(target_id)):
        _migrate_project(
            client,  # type: ignore[arg-type]
            source_project_id=source_id,
            target_project_id=target_id,
        )


def test_migrate_project_uses_expected_route_and_payload():
    client = DummyClient()
    source_project_id = uuid4()
    target_project_id = uuid4()

    _migrate_project(
        client,  # type: ignore[arg-type]
        source_project_id=source_project_id,
        target_project_id=target_project_id,
        archive_source_as="legacy_source_project",
    )

    assert client.calls == [
        (
            "/projects/migrate",
            {
                "sourceProjectUUID": str(source_project_id),
                "targetProjectUUID": str(target_project_id),
                "archiveSourceProjectAs": "legacy_source_project",
            },
        )
    ]


@pytest.mark.parametrize(
    "status_code,error_type",
    [
        pytest.param(401, kleinkram.errors.AccessDenied, id="401-api-key-not-allowed"),
        pytest.param(403, kleinkram.errors.AccessDenied, id="403-access-denied"),
        pytest.param(404, kleinkram.errors.ProjectNotFound, id="404-project-not-found"),
        pytest.param(400, kleinkram.errors.ProjectValidationError, id="400-invalid-request"),
        pytest.param(409, kleinkram.errors.ProjectValidationError, id="409-migration-conflict"),
    ],
)
def test_migrate_project_maps_http_errors(status_code, error_type):  # noqa: ANN001
    client = DummyClient(status_code=status_code)
    source_project_id = uuid4()
    target_project_id = uuid4()

    with pytest.raises(error_type):
        _migrate_project(
            client,  # type: ignore[arg-type]
            source_project_id=source_project_id,
            target_project_id=target_project_id,
        )
