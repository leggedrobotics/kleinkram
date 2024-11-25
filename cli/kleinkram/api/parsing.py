from __future__ import annotations

from typing import Any
from typing import Dict
from typing import Optional
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


def _parse_project(project: Dict[str, Any]) -> Project:
    try:
        project_id = UUID(project["uuid"], version=4)
        project_name = project["name"]
        project_description = project["description"]

        parsed = Project(
            id=project_id, name=project_name, description=project_description
        )
    except Exception:
        raise ParsingError(f"error parsing project: {project}")
    return parsed


def _parse_mission(
    mission: Dict[str, Any], project: Optional[Project] = None
) -> Mission:
    try:
        mission_id = UUID(mission["uuid"], version=4)
        mission_name = mission["name"]

        project_id = (
            project.id if project else UUID(mission["project"]["uuid"], version=4)
        )
        project_name = project.name if project else mission["project"]["name"]

        parsed = Mission(
            id=mission_id,
            name=mission_name,
            project_id=project_id,
            project_name=project_name,
        )
    except Exception:
        raise ParsingError(f"error parsing mission: {mission}")
    return parsed


def _parse_file(file: Dict[str, Any], mission: Optional[Mission] = None) -> File:
    try:
        filename = file["filename"]
        file_id = UUID(file["uuid"], version=4)
        file_size = file["size"]
        file_hash = file["hash"]

        project_id = (
            mission.project_id if mission else UUID(file["project"]["uuid"], version=4)
        )
        project_name = mission.project_name if mission else file["project"]["name"]

        mission_id = mission.id if mission else UUID(file["mission"]["uuid"], version=4)
        mission_name = mission.name if mission else file["mission"]["name"]

        parsed = File(
            id=file_id,
            name=filename,
            size=file_size,
            hash=file_hash,
            project_id=project_id,
            project_name=project_name,
            mission_id=mission_id,
            mission_name=mission_name,
            state=FileState(file["state"]),
        )
    except Exception:
        raise ParsingError(f"error parsing file: {file}")
    return parsed
