"""\
this file contains dataclasses for specifying remote resources on kleinkram
here we also provide some helper functions to validate certain properties
of these specifications

additionally we provide wrappers around the api for fetching the specified
resources (TODO: move this part to another file)
"""

from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from typing import List
from uuid import UUID

from kleinkram.errors import InvalidMissionQuery
from kleinkram.errors import InvalidProjectQuery

MAX_PARALLEL_REQUESTS = 32
SPECIAL_PATTERN_CHARS = ["*", "?", "[", "]"]


@dataclass
class ProjectQuery:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)


@dataclass
class MissionQuery:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)
    project_query: ProjectQuery = field(default_factory=ProjectQuery)


@dataclass
class FileQuery:
    patterns: List[str] = field(default_factory=list)
    ids: List[UUID] = field(default_factory=list)
    mission_query: MissionQuery = field(default_factory=MissionQuery)


def check_mission_query_is_creatable(query: MissionQuery) -> str:
    """\
    check if a query is unique and can be used to create a mission
    returns: the mission name
    """
    if not mission_query_is_unique(query):
        raise InvalidMissionQuery(f"Mission query is not unique: {query}")
    # cant create a missing by id
    if query.ids:
        raise InvalidMissionQuery(f"cant create mission by id: {query}")
    return query.patterns[0]


def check_project_query_is_creatable(query: ProjectQuery) -> str:
    if not project_query_is_unique(query):
        raise InvalidProjectQuery(f"Project query is not unique: {query}")
    # cant create a missing by id
    if query.ids:
        raise InvalidProjectQuery(f"cant create project by id: {query}")
    return query.patterns[0]


def _pattern_is_unique(pattern: str) -> bool:
    for char in SPECIAL_PATTERN_CHARS:
        if char in pattern:
            return False
    return True


def project_query_is_unique(query: ProjectQuery) -> bool:
    # a single project id is specified
    if len(query.ids) == 1 and not query.patterns:
        return True

    # a single project name is specified
    if len(query.patterns) == 1 and _pattern_is_unique(query.patterns[0]):
        return True
    return False


def mission_query_is_unique(query: MissionQuery) -> bool:
    # a single mission id is specified
    if len(query.ids) == 1 and not query.patterns:
        return True

    # a single mission name a unique project spec are specified
    if (
        project_query_is_unique(query.project_query)
        and len(query.patterns) == 1
        and _pattern_is_unique(query.patterns[0])
    ):
        return True
    return False


def file_query_is_unique(query: FileQuery) -> bool:
    # a single file id is specified
    if len(query.ids) == 1 and not query.patterns:
        return True

    # a single file name a unique mission spec are specified
    if (
        mission_query_is_unique(query.mission_query)
        and len(query.patterns) == 1
        and _pattern_is_unique(query.patterns[0])
    ):
        return True
    return False
