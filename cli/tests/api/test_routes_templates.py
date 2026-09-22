from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from kleinkram.api.deser import TemplateObject
from kleinkram.api.deser import _parse_action_template
from kleinkram.api.routes import _create_template
from kleinkram.api.routes import _create_template_version

TEMPLATE_UUID = uuid4()


def _template_payload(*, max_runtime_hours: float) -> TemplateObject:
    return TemplateObject(
        {
            "uuid": str(TEMPLATE_UUID),
            "name": "template",
            "description": "a template",
            "accessRights": 0,
            "command": "echo hello",
            "cpuCores": 1,
            "cpuMemory": 1,
            "entrypoint": "",
            "gpuMemory": -1,
            "imageName": "ubuntu:latest",
            "maxRuntime": max_runtime_hours,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "version": "1",
        }
    )


def _mock_client():
    client = MagicMock()
    response = MagicMock(status_code=200)
    response.json.return_value = {"uuid": str(uuid4())}
    client.post.return_value = response
    return client


@pytest.mark.parametrize(
    ("minutes", "hours"),
    [(60, 1), (15, 0.25), (150, 2.5), (1, 1 / 60)],
)
def test_create_template_sends_max_runtime_in_hours(minutes, hours):
    client = _mock_client()

    _create_template(
        client,
        name="template",
        description="a template",
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=minutes,
    )

    _, kwargs = client.post.call_args
    assert kwargs["json"]["maxRuntime"] == pytest.approx(hours)


def test_create_template_version_sends_max_runtime_in_hours():
    client = _mock_client()

    _create_template_version(
        client,
        TEMPLATE_UUID,
        name="template",
        description="a template",
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=15,
        access_rights=0,
    )

    _, kwargs = client.post.call_args
    assert kwargs["json"]["maxRuntime"] == pytest.approx(0.25)


@pytest.mark.parametrize(
    ("hours", "minutes"),
    [(1, 60), (0.25, 15), (2.5, 150)],
)
def test_parse_action_template_converts_hours_to_minutes(hours, minutes):
    template = _parse_action_template(_template_payload(max_runtime_hours=hours))
    assert template.max_runtime_minutes == minutes


def test_max_runtime_round_trips_through_create_and_parse():
    client = _mock_client()

    _create_template(
        client,
        name="template",
        description="a template",
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=15,
    )

    _, kwargs = client.post.call_args
    template = _parse_action_template(_template_payload(max_runtime_hours=kwargs["json"]["maxRuntime"]))
    assert template.max_runtime_minutes == 15
