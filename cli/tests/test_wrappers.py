from __future__ import annotations

from uuid import uuid4

from kleinkram.api.query import FileSpec
from kleinkram.api.query import MissionSpec
from kleinkram.api.query import ProjectSpec
from kleinkram.wrappers import _args_to_file_spec
from kleinkram.wrappers import _args_to_mission_spec
from kleinkram.wrappers import _args_to_project_spec


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
