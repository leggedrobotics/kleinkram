from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from typing import Dict
from typing import NewType
from uuid import UUID

from kleinkram.errors import ParsingError
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.models import Mission
from kleinkram.models import Project

__all__ = [
    "_parse_project",
    "_parse_mission",
    "_parse_file",
]


ProjectObject = NewType("ProjectObject", Dict[str, Any])
MissionObject = NewType("MissionObject", Dict[str, Any])
FileObject = NewType("FileObject", Dict[str, Any])

PROJECT_OBJECT_KEYS = []
MISSION_OBJECT_KEYS = []


class FileObjectKeys(str, Enum):
    UUID = "uuid"
    FILENAME = "filename"
    DATE = "date"  # at some point this will become a metadata
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    STATE = "state"
    SIZE = "size"
    HASH = "hash"
    TYPE = "type"
    TAGS = "categories"


class MissionObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    PROJECT = "project"


class ProjectObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"


def _parse_datetime(date: str) -> datetime:
    try:
        return datetime.fromisoformat(date)
    except ValueError as e:
        raise ParsingError(f"error parsing date: {date}") from e


def _parse_file_state(state: str) -> FileState:
    try:
        return FileState(state)
    except ValueError as e:
        raise ParsingError(f"error parsing file state: {state}") from e


def _parse_project(project_object: ProjectObject) -> Project:
    try:
        id_ = UUID(project_object[ProjectObjectKeys.UUID], version=4)
        name = project_object[ProjectObjectKeys.NAME]
        description = project_object[ProjectObjectKeys.DESCRIPTION]
        created_at = _parse_datetime(project_object[ProjectObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(project_object[ProjectObjectKeys.UPDATED_AT])
    except Exception as e:
        raise ParsingError(f"error parsing project: {project_object}") from e
    return Project(
        id=id_,
        name=name,
        description=description,
        created_at=created_at,
        updated_at=updated_at,
    )


def _parse_mission(mission: MissionObject, project: Project) -> Mission:
    try:
        id_ = UUID(mission[MissionObjectKeys.UUID], version=4)
        name = mission[MissionObjectKeys.NAME]
        created_at = _parse_datetime(mission[MissionObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(mission[MissionObjectKeys.UPDATED_AT])
        metadata = {}  # TODO: this crap is really bad to parse

        parsed = Mission(
            id=id_,
            name=name,
            created_at=created_at,
            updated_at=updated_at,
            metadata=metadata,
            project_id=project.id,
            project_name=project.name,
        )
    except Exception as e:
        raise ParsingError(f"error parsing mission: {mission}") from e
    return parsed


def _parse_file(file: FileObject, mission: Mission) -> File:
    try:
        name = file[FileObjectKeys.FILENAME]
        id_ = UUID(file[FileObjectKeys.UUID], version=4)
        fsize = file[FileObjectKeys.SIZE]
        fhash = file[FileObjectKeys.HASH]
        ftype = file[FileObjectKeys.TYPE].split(".")[-1]
        fdate = file[FileObjectKeys.DATE]
        created_at = _parse_datetime(file[FileObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(file[FileObjectKeys.UPDATED_AT])
        state = _parse_file_state(file[FileObjectKeys.STATE])
        tags = file[FileObjectKeys.TAGS]

        parsed = File(
            id=id_,
            name=name,
            hash=fhash,
            size=fsize,
            type_=ftype,
            date=fdate,
            tags=tags,
            state=state,
            created_at=created_at,
            updated_at=updated_at,
            mission_id=mission.id,
            mission_name=mission.name,
            project_id=mission.project_id,
            project_name=mission.project_name,
        )
    except Exception as e:
        raise ParsingError(f"error parsing file: {file}") from e
    return parsed
