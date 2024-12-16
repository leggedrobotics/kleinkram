from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest

from kleinkram.api.resources import FileSpec
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.core import _args_to_file_spec
from kleinkram.core import _args_to_mission_spec
from kleinkram.core import _args_to_project_spec
from kleinkram.core import _parse_path_like
from kleinkram.core import _parse_uuid_like
from kleinkram.core import _singleton_list


@pytest.mark.slow
def test_upload_project_not_found() -> None: ...


@pytest.mark.slow
def test_upload_mission_not_found() -> None: ...


@pytest.mark.slow
def test_upload_create() -> None: ...


@pytest.mark.slow
def test_download() -> None: ...


def test_singleton_list() -> None:
    assert [] == _singleton_list(None)
    assert [1] == _singleton_list(1)
    assert [[1]] == _singleton_list([1])
    assert [True] == _singleton_list(True)

    ob = object()
    assert [ob] == _singleton_list(ob)


def test_parse_uuid_like() -> None:
    _id = uuid4()
    assert _parse_uuid_like(str(_id)) == _id
    assert _parse_uuid_like(_id) == _id

    with pytest.raises(ValueError):
        _parse_uuid_like("invalid")


def parse_path_like() -> None:
    assert _parse_path_like("test") == Path("test")
    assert _parse_path_like(Path("test")) == Path("test")


def test_args_to_project_spec() -> None:
    assert _args_to_project_spec() == ProjectSpec()
    assert _args_to_project_spec(project_names=["test"]) == ProjectSpec(
        patterns=["test"]
    )

    _id = uuid4()
    assert _args_to_project_spec(project_ids=[_id]) == ProjectSpec(ids=[_id])
    assert _args_to_project_spec(
        project_names=["test"], project_ids=[_id]
    ) == ProjectSpec(patterns=["test"], ids=[_id])
    assert _args_to_project_spec(project_ids=[str(_id)]) == ProjectSpec(ids=[_id])


def test_args_to_mission_spec() -> None:
    assert _args_to_mission_spec() == MissionSpec()
    assert _args_to_mission_spec(mission_names=["test"]) == MissionSpec(
        patterns=["test"]
    )

    _id = uuid4()
    assert _args_to_mission_spec(mission_ids=[_id]) == MissionSpec(ids=[_id])
    assert _args_to_mission_spec(
        mission_names=["test"], mission_ids=[_id]
    ) == MissionSpec(patterns=["test"], ids=[_id])
    assert _args_to_mission_spec(mission_ids=[str(_id)]) == MissionSpec(ids=[_id])

    assert _args_to_mission_spec(project_names=["test"]) == MissionSpec(
        project_spec=ProjectSpec(patterns=["test"])
    )
    assert _args_to_mission_spec(project_ids=[_id]) == MissionSpec(
        project_spec=ProjectSpec(ids=[_id])
    )


def test_args_to_file_spec() -> None:
    assert _args_to_file_spec() == FileSpec()
    assert _args_to_file_spec(file_names=["test"]) == FileSpec(patterns=["test"])

    _id = uuid4()
    assert _args_to_file_spec(file_ids=[_id]) == FileSpec(ids=[_id])
    assert _args_to_file_spec(file_names=["test"], file_ids=[_id]) == FileSpec(
        patterns=["test"], ids=[_id]
    )
    assert _args_to_file_spec(file_ids=[str(_id)]) == FileSpec(ids=[_id])

    assert _args_to_file_spec(mission_names=["test"]) == FileSpec(
        mission_spec=MissionSpec(patterns=["test"])
    )
    assert _args_to_file_spec(mission_ids=[_id]) == FileSpec(
        mission_spec=MissionSpec(ids=[_id])
    )

    assert _args_to_file_spec(project_names=["test"]) == FileSpec(
        mission_spec=MissionSpec(project_spec=ProjectSpec(patterns=["test"]))
    )
    assert _args_to_file_spec(project_ids=[_id]) == FileSpec(
        mission_spec=MissionSpec(project_spec=ProjectSpec(ids=[_id]))
    )
