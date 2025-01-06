from __future__ import annotations

from uuid import uuid4

import pytest

from kleinkram.api.query import InvalidMissionSpec
from kleinkram.api.query import InvalidProjectSpec
from kleinkram.api.query import MissionSpec
from kleinkram.api.query import ProjectSpec
from kleinkram.api.query import check_mission_spec_is_creatable
from kleinkram.api.query import check_project_spec_is_creatable
from kleinkram.api.query import mission_spec_is_unique
from kleinkram.api.query import project_spec_is_unique


@pytest.mark.parametrize(
    "spec, expected",
    [
        pytest.param(MissionSpec(), False, id="match all"),
        pytest.param(MissionSpec(patterns=["*"]), False, id="mission name match all"),
        pytest.param(
            MissionSpec(patterns=["test"]),
            False,
            id="mission name without project",
        ),
        pytest.param(
            MissionSpec(patterns=["test"], project_spec=ProjectSpec()),
            False,
            id="mission name with non-unique project",
        ),
        pytest.param(
            MissionSpec(
                patterns=["test"],
                project_spec=ProjectSpec(ids=[uuid4()]),
            ),
            True,
            id="mission name with unique project",
        ),
        pytest.param(
            MissionSpec(ids=[uuid4()]),
            True,
            id="mission by id",
        ),
        pytest.param(
            MissionSpec(ids=[uuid4(), uuid4()]),
            False,
            id="multiple mission ids",
        ),
    ],
)
def test_mission_spec_is_unique(spec, expected):
    assert mission_spec_is_unique(spec) == expected


@pytest.mark.parametrize(
    "spec, expected",
    [
        pytest.param(ProjectSpec(), False, id="match all"),
        pytest.param(ProjectSpec(patterns=["*"]), False, id="project name match all"),
        pytest.param(
            ProjectSpec(patterns=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectSpec(ids=[uuid4()]),
            True,
            id="project by id",
        ),
        pytest.param(
            ProjectSpec(ids=[uuid4(), uuid4()]),
            False,
            id="multiple project ids",
        ),
    ],
)
def test_project_spec_is_unique(spec, expected):
    assert project_spec_is_unique(spec) == expected


@pytest.mark.parametrize(
    "spec, valid",
    [
        pytest.param(
            MissionSpec(patterns=["test"], project_spec=ProjectSpec()),
            False,
            id="non-unique project",
        ),
        pytest.param(
            MissionSpec(
                patterns=["test"],
                project_spec=ProjectSpec(ids=[uuid4()]),
            ),
            True,
            id="valid spec",
        ),
        pytest.param(
            MissionSpec(ids=[uuid4()]),
            False,
            id="mission by id",
        ),
    ],
)
def test_check_mission_spec_is_createable(spec, valid):
    if not valid:
        with pytest.raises(InvalidMissionSpec):
            check_mission_spec_is_creatable(spec)
    else:
        check_mission_spec_is_creatable(spec)


@pytest.mark.parametrize(
    "spec, valid",
    [
        pytest.param(
            ProjectSpec(patterns=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectSpec(ids=[uuid4()]),
            False,
            id="project by id",
        ),
        pytest.param(
            ProjectSpec(ids=[uuid4(), uuid4()]),
            False,
            id="multiple project ids",
        ),
    ],
)
def test_check_project_spec_is_creatable(spec, valid):
    if not valid:
        with pytest.raises(InvalidProjectSpec):
            check_project_spec_is_creatable(spec)
    else:
        check_project_spec_is_creatable(spec)
