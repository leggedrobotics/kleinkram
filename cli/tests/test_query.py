from __future__ import annotations

from uuid import uuid4

import pytest

from kleinkram.api.query import InvalidMissionQuery
from kleinkram.api.query import InvalidProjectQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.query import check_mission_query_is_creatable
from kleinkram.api.query import check_project_query_is_creatable
from kleinkram.api.query import mission_query_is_unique
from kleinkram.api.query import project_query_is_unique


@pytest.mark.parametrize(
    "query, expected",
    [
        pytest.param(MissionQuery(), False, id="match all"),
        pytest.param(MissionQuery(patterns=["*"]), False, id="mission name match all"),
        pytest.param(
            MissionQuery(patterns=["test"]),
            False,
            id="mission name without project",
        ),
        pytest.param(
            MissionQuery(patterns=["test"], project_query=ProjectQuery()),
            False,
            id="mission name with non-unique project",
        ),
        pytest.param(
            MissionQuery(
                patterns=["test"],
                project_query=ProjectQuery(ids=[uuid4()]),
            ),
            True,
            id="mission name with unique project",
        ),
        pytest.param(
            MissionQuery(ids=[uuid4()]),
            True,
            id="mission by id",
        ),
        pytest.param(
            MissionQuery(ids=[uuid4(), uuid4()]),
            False,
            id="multiple mission ids",
        ),
    ],
)
def test_mission_query_is_unique(query, expected):
    assert mission_query_is_unique(query) == expected


@pytest.mark.parametrize(
    "query, expected",
    [
        pytest.param(ProjectQuery(), False, id="match all"),
        pytest.param(ProjectQuery(patterns=["*"]), False, id="project name match all"),
        pytest.param(
            ProjectQuery(patterns=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectQuery(ids=[uuid4()]),
            True,
            id="project by id",
        ),
        pytest.param(
            ProjectQuery(ids=[uuid4(), uuid4()]),
            False,
            id="multiple project ids",
        ),
    ],
)
def test_project_query_is_unique(query, expected):
    assert project_query_is_unique(query) == expected


@pytest.mark.parametrize(
    "query, valid",
    [
        pytest.param(
            MissionQuery(patterns=["test"], project_query=ProjectQuery()),
            False,
            id="non-unique project",
        ),
        pytest.param(
            MissionQuery(
                patterns=["test"],
                project_query=ProjectQuery(ids=[uuid4()]),
            ),
            True,
            id="valid query",
        ),
        pytest.param(
            MissionQuery(ids=[uuid4()]),
            False,
            id="mission by id",
        ),
    ],
)
def test_check_mission_query_is_createable(query, valid):
    if not valid:
        with pytest.raises(InvalidMissionQuery):
            check_mission_query_is_creatable(query)
    else:
        check_mission_query_is_creatable(query)


@pytest.mark.parametrize(
    "query, valid",
    [
        pytest.param(
            ProjectQuery(patterns=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectQuery(ids=[uuid4()]),
            False,
            id="project by id",
        ),
        pytest.param(
            ProjectQuery(ids=[uuid4(), uuid4()]),
            False,
            id="multiple project ids",
        ),
    ],
)
def test_check_project_query_is_creatable(query, valid):
    if not valid:
        with pytest.raises(InvalidProjectQuery):
            check_project_query_is_creatable(query)
    else:
        check_project_query_is_creatable(query)
