from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from typing import List
from uuid import UUID

from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.utils import filtered_by_patterns


@dataclass
class ProjectSpec:
    project_filters: List[str] = field(default_factory=list)
    project_ids: List[UUID] = field(default_factory=list)


@dataclass
class MissionSpec:
    mission_filters: List[str] = field(default_factory=list)
    mission_ids: List[UUID] = field(default_factory=list)
    project_spec: ProjectSpec = field(default=ProjectSpec())


@dataclass
class FileSpec:
    file_filters: List[str] = field(default_factory=list)
    file_ids: List[UUID] = field(default_factory=list)
    mission_spec: MissionSpec = field(default=MissionSpec())


SPECIAL_PATTERN_CHARS = ["*", "?", "[", "]"]


class InvalidMissionSpec(Exception): ...


class InvalidProjectSpec(Exception): ...


def check_mission_spec_is_createable(spec: MissionSpec) -> None:
    if not mission_spec_is_unique(spec):
        raise InvalidMissionSpec(f"Mission spec is not unique: {spec}")
    # cant create a missing by id
    if spec.mission_ids:
        raise InvalidMissionSpec(f"cant create mission by id: {spec}")


def check_project_spec_is_creatable(spec: ProjectSpec) -> None:
    if not project_spec_is_unique(spec):
        raise InvalidProjectSpec(f"Project spec is not unique: {spec}")
    # cant create a missing by id
    if spec.project_ids:
        raise InvalidProjectSpec(f"cant create project by id: {spec}")


def pattern_is_unique(pattern: str) -> bool:
    for char in SPECIAL_PATTERN_CHARS:
        if char in pattern:
            return False
    return True


def project_spec_is_unique(spec: ProjectSpec) -> bool:
    # a single project id is specified
    if len(spec.project_ids) == 1 and not spec.project_filters:
        return True

    # a single project name is specified
    if len(spec.project_filters) == 1 and pattern_is_unique(spec.project_filters[0]):
        return True
    return False


def mission_spec_is_unique(spec: MissionSpec) -> bool:
    # a single mission id is specified
    if len(spec.mission_ids) == 1 and not spec.mission_filters:
        return True

    # a single mission name a unique project spec are specified
    if (
        project_spec_is_unique(spec.project_spec)
        and len(spec.mission_filters) == 1
        and pattern_is_unique(spec.mission_filters[0])
    ):
        return True
    return False


def get_projects_by_spec(spec: ProjectSpec) -> List[Project]:
    projects = []  # TODO: get projects

    matched_names = filtered_by_patterns(
        [project.name for project in projects], spec.project_filters
    )

    return [
        project
        for project in projects
        if project.name in matched_names or project.id in spec.project_ids
    ]


def get_missions_by_spec(spec: MissionSpec) -> List[Mission]:
    projects = get_projects_by_spec(spec.project_spec)

    ret = []
    for project in projects:
        missions = []  # TODO: get missions from project

        matched_names = filtered_by_patterns(
            [mission.name for mission in missions], spec.mission_filters
        )

        ret.extend(
            [
                mission
                for mission in missions
                if mission.name in matched_names or mission.id in spec.mission_ids
            ]
        )

    return []


def get_files_by_spec(spec: FileSpec) -> List[File]:
    missions = get_missions_by_spec(spec.mission_spec)

    ret = []
    for mission in missions:
        files = []  # TODO: get files from mission

        matched_names = filtered_by_patterns(
            [file.name for file in files], spec.file_filters
        )

        ret.extend(
            [
                file
                for file in files
                if file.name in matched_names or file.id in spec.file_ids
            ]
        )

    return ret
