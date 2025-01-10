from __future__ import annotations

from uuid import uuid4

from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.wrappers import _args_to_file_query
from kleinkram.wrappers import _args_to_mission_query
from kleinkram.wrappers import _args_to_project_query


def test_args_to_project_query() -> None:
    assert _args_to_project_query() == ProjectQuery()
    assert _args_to_project_query(project_names=["test"]) == ProjectQuery(
        patterns=["test"]
    )

    _id = uuid4()
    assert _args_to_project_query(project_ids=[_id]) == ProjectQuery(ids=[_id])
    assert _args_to_project_query(
        project_names=["test"], project_ids=[_id]
    ) == ProjectQuery(patterns=["test"], ids=[_id])
    assert _args_to_project_query(project_ids=[str(_id)]) == ProjectQuery(ids=[_id])


def test_args_to_mission_query() -> None:
    assert _args_to_mission_query() == MissionQuery()
    assert _args_to_mission_query(mission_names=["test"]) == MissionQuery(
        patterns=["test"]
    )

    _id = uuid4()
    assert _args_to_mission_query(mission_ids=[_id]) == MissionQuery(ids=[_id])
    assert _args_to_mission_query(
        mission_names=["test"], mission_ids=[_id]
    ) == MissionQuery(patterns=["test"], ids=[_id])
    assert _args_to_mission_query(mission_ids=[str(_id)]) == MissionQuery(ids=[_id])

    assert _args_to_mission_query(project_names=["test"]) == MissionQuery(
        project_query=ProjectQuery(patterns=["test"])
    )
    assert _args_to_mission_query(project_ids=[_id]) == MissionQuery(
        project_query=ProjectQuery(ids=[_id])
    )


def test_args_to_file_query() -> None:
    assert _args_to_file_query() == FileQuery()
    assert _args_to_file_query(file_names=["test"]) == FileQuery(patterns=["test"])

    _id = uuid4()
    assert _args_to_file_query(file_ids=[_id]) == FileQuery(ids=[_id])
    assert _args_to_file_query(file_names=["test"], file_ids=[_id]) == FileQuery(
        patterns=["test"], ids=[_id]
    )
    assert _args_to_file_query(file_ids=[str(_id)]) == FileQuery(ids=[_id])

    assert _args_to_file_query(mission_names=["test"]) == FileQuery(
        mission_query=MissionQuery(patterns=["test"])
    )
    assert _args_to_file_query(mission_ids=[_id]) == FileQuery(
        mission_query=MissionQuery(ids=[_id])
    )

    assert _args_to_file_query(project_names=["test"]) == FileQuery(
        mission_query=MissionQuery(project_query=ProjectQuery(patterns=["test"]))
    )
    assert _args_to_file_query(project_ids=[_id]) == FileQuery(
        mission_query=MissionQuery(project_query=ProjectQuery(ids=[_id]))
    )
