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
    """\
    check if a spec is unique and can be used to create a mission
    returns: the mission name
    """
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


def file_spec_is_unique(spec: FileSpec) -> bool:
    # a single file id is specified
    if len(spec.ids) == 1 and not spec.patterns:
        return True

    # a single file name a unique mission spec are specified
    if (
        mission_spec_is_unique(spec.mission_spec)
        and len(spec.patterns) == 1
        and _pattern_is_unique(spec.patterns[0])
    ):
        return True
    return False
