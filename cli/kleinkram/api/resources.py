"""\
this file contains dataclasses for specifying remote resources on kleinkram
here we also provide some helper functions to validate certain properties
of these specifications

additionally we provide wrappers around the api for fetching the specified
resources (TODO: move this part to another file)
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from dataclasses import field
from itertools import chain
from typing import Generator
from typing import List
from uuid import UUID

import kleinkram.errors
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import _get_files_by_mission
from kleinkram.api.routes import _get_missions_by_project
from kleinkram.api.routes import _get_projects
from kleinkram.errors import InvalidMissionSpec
from kleinkram.errors import InvalidProjectSpec
from kleinkram.errors import MissionNotFound
from kleinkram.errors import ProjectNotFound
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.utils import filtered_by_patterns

MAX_PARALLEL_REQUESTS = 32
SPECIAL_PATTERN_CHARS = ["*", "?", "[", "]"]


@dataclass
class ProjectSpec:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)


@dataclass
class MissionSpec:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)
    project_spec: ProjectSpec = field(default=ProjectSpec())


@dataclass
class FileSpec:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)
    mission_spec: MissionSpec = field(default=MissionSpec())


def check_mission_spec_is_creatable(spec: MissionSpec) -> str:
    if not mission_spec_is_unique(spec):
        raise InvalidMissionSpec(f"Mission spec is not unique: {spec}")
    # cant create a missing by id
    if spec.ids:
        raise InvalidMissionSpec(f"cant create mission by id: {spec}")
    return spec.patterns[0]


def check_project_spec_is_creatable(spec: ProjectSpec) -> str:
    if not project_spec_is_unique(spec):
        raise InvalidProjectSpec(f"Project spec is not unique: {spec}")
    # cant create a missing by id
    if spec.ids:
        raise InvalidProjectSpec(f"cant create project by id: {spec}")
    return spec.patterns[0]


def _pattern_is_unique(pattern: str) -> bool:
    for char in SPECIAL_PATTERN_CHARS:
        if char in pattern:
            return False
    return True


def project_spec_is_unique(spec: ProjectSpec) -> bool:
    # a single project id is specified
    if len(spec.ids) == 1 and not spec.patterns:
        return True

    # a single project name is specified
    if len(spec.patterns) == 1 and _pattern_is_unique(spec.patterns[0]):
        return True
    return False


def mission_spec_is_unique(spec: MissionSpec) -> bool:
    # a single mission id is specified
    if len(spec.ids) == 1 and not spec.patterns:
        return True

    # a single mission name a unique project spec are specified
    if (
        project_spec_is_unique(spec.project_spec)
        and len(spec.patterns) == 1
        and _pattern_is_unique(spec.patterns[0])
    ):
        return True
    return False


def get_projects(
    client: AuthenticatedClient, spec: ProjectSpec
) -> Generator[Project, None, None]:
    projects = _get_projects(client)

    matched_names = filtered_by_patterns(
        [project.name for project in projects], spec.patterns
    )

    if not spec.patterns and not spec.ids:
        yield from projects

    yield from [
        project
        for project in projects
        if project.name in matched_names or project.id in spec.ids
    ]


def get_missions(
    client: AuthenticatedClient, spec: MissionSpec
) -> Generator[Mission, None, None]:
    projects = get_projects(client, spec.project_spec)

    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_REQUESTS) as executor:
        missions = chain.from_iterable(
            executor.map(
                lambda project: _get_missions_by_project(client, project), projects
            )
        )

    missions = list(missions)

    if not spec.patterns and not spec.ids:
        yield from list(missions)

    matched_names = filtered_by_patterns(
        [mission.name for mission in missions], spec.patterns
    )

    yield from [
        mission
        for mission in missions
        if mission.name in matched_names or mission.id in spec.ids
    ]


def get_files(
    client: AuthenticatedClient, spec: FileSpec
) -> Generator[File, None, None]:
    missions = get_missions(client, spec.mission_spec)

    # collect files
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_REQUESTS) as executor:
        files = chain.from_iterable(
            executor.map(
                lambda mission: _get_files_by_mission(client, mission), missions
            )
        )

    if not spec.patterns and not spec.ids:
        yield from list(files)
    matched_names = filtered_by_patterns([file.name for file in files], spec.patterns)

    yield from [
        file for file in files if file.name in matched_names or file.id in spec.ids
    ]


def get_project(client: AuthenticatedClient, spec: ProjectSpec) -> Project:
    """\
    get a unique project by specifying a project spec
    """
    if not project_spec_is_unique(spec):
        raise InvalidProjectSpec(
            f"Project spec does not uniquely determine project: {spec}"
        )
    try:
        return next(get_projects(client, spec))
    except StopIteration:
        raise ProjectNotFound(f"Project not found: {spec}")


def get_mission(client: AuthenticatedClient, spec: MissionSpec) -> Mission:
    """\
    get a unique mission by specifying a mission spec
    """
    if not mission_spec_is_unique(spec):
        raise InvalidMissionSpec(
            f"Mission spec does not uniquely determine mission: {spec}"
        )
    try:
        return next(get_missions(client, spec))
    except StopIteration:
        raise MissionNotFound(f"Mission not found: {spec}")


def get_file(client: AuthenticatedClient, spec: FileSpec) -> File:
    """\
    get a unique file by specifying a file spec
    """
    try:
        return next(get_files(client, spec))
    except StopIteration:
        raise kleinkram.errors.FileNotFound(f"File not found: {spec}")
