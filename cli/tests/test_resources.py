from __future__ import annotations

from uuid import uuid4

import pytest
from kleinkram.resources import check_mission_spec_is_createable
from kleinkram.resources import check_project_spec_is_creatable
from kleinkram.resources import FileSpec
from kleinkram.resources import InvalidMissionSpec
from kleinkram.resources import InvalidProjectSpec
from kleinkram.resources import mission_spec_is_unique
from kleinkram.resources import MissionSpec
from kleinkram.resources import pattern_is_unique
from kleinkram.resources import project_spec_is_unique
from kleinkram.resources import ProjectSpec


@pytest.mark.parametrize(
    "spec, expected",
    [
        pytest.param(MissionSpec(), False, id="match all"),
        pytest.param(
            MissionSpec(mission_filters=["*"]), False, id="mission name match all"
        ),
        pytest.param(
            MissionSpec(mission_filters=["test"]),
            False,
            id="mission name without project",
        ),
        pytest.param(
            MissionSpec(mission_filters=["test"], project_spec=ProjectSpec()),
            False,
            id="mission name with non-unique project",
        ),
        pytest.param(
            MissionSpec(
                mission_filters=["test"],
                project_spec=ProjectSpec(project_ids=[uuid4()]),
            ),
            True,
            id="mission name with unique project",
        ),
        pytest.param(
            MissionSpec(mission_ids=[uuid4()]),
            True,
            id="mission by id",
        ),
        pytest.param(
            MissionSpec(mission_ids=[uuid4(), uuid4()]),
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
        pytest.param(
            ProjectSpec(project_filters=["*"]), False, id="project name match all"
        ),
        pytest.param(
            ProjectSpec(project_filters=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectSpec(project_ids=[uuid4()]),
            True,
            id="project by id",
        ),
        pytest.param(
            ProjectSpec(project_ids=[uuid4(), uuid4()]),
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
            MissionSpec(mission_filters=["test"], project_spec=ProjectSpec()),
            False,
            id="non-unique project",
        ),
        pytest.param(
            MissionSpec(
                mission_filters=["test"],
                project_spec=ProjectSpec(project_ids=[uuid4()]),
            ),
            True,
            id="valid spec",
        ),
        pytest.param(
            MissionSpec(mission_ids=[uuid4()]),
            False,
            id="mission by id",
        ),
    ],
)
def test_check_mission_spec_is_createable(spec, valid):
    if not valid:
        with pytest.raises(InvalidMissionSpec):
            check_mission_spec_is_createable(spec)
    else:
        check_mission_spec_is_createable(spec)


@pytest.mark.parametrize(
    "spec, valid",
    [
        pytest.param(
            ProjectSpec(project_filters=["test"]),
            True,
            id="project name",
        ),
        pytest.param(
            ProjectSpec(project_ids=[uuid4()]),
            False,
            id="project by id",
        ),
        pytest.param(
            ProjectSpec(project_ids=[uuid4(), uuid4()]),
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
