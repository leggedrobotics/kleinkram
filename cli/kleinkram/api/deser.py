from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from typing import Dict
from typing import List
from typing import Literal
from typing import NewType
from typing import Tuple
from uuid import UUID

import dateutil.parser

from kleinkram.errors import ParsingError
from kleinkram.models import ActionTemplate
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.models import LogEntry
from kleinkram.models import MetadataValue
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.models import Run

__all__ = [
    "_parse_project",
    "_parse_mission",
    "_parse_file",
]


ProjectObject = NewType("ProjectObject", Dict[str, Any])
MissionObject = NewType("MissionObject", Dict[str, Any])
FileObject = NewType("FileObject", Dict[str, Any])
RunObject = NewType("RunObject", Dict[str, Any])

MISSION = "mission"
PROJECT = "project"


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
    CATEGORIES = "categories"


class MissionObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    TAGS = "tags"
    FILESIZE = "size"
    FILECOUNT = "filesCount"


class ProjectObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    REQUIRED_TAGS = "requiredTags"


class RunObjectKeys(str, Enum):
    UUID = "uuid"
    STATE = "state"
    STATE_CAUSE = "stateCause"
    CREATED_AT = "createdAt"
    MISSION = "mission"
    TEMPLATE = "template"
    UPDATED_AT = "updatedAt"
    LOGS = "logs"
    ARTIFACT_URL = "artifactUrl"


class TemplateObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    ACCESS_RIGHTS = "accessRights"
    COMMAND = "command"
    CPU_CORES = "cpuCores"
    CPU_MEMORY_GB = "cpuMemory"
    ENTRYPOINT = "entrypoint"
    GPU_MEMORY_GB = "gpuMemory"
    IMAGE_NAME = "imageName"
    MAX_RUNTIME_MINUTES = "maxRuntime"
    CREATED_AT = "createdAt"
    VERSION = "version"


class LogEntryObjectKeys(str, Enum):
    TIMESTAMP = "timestamp"
    LEVEL = "type"
    MESSAGE = "message"


def _get_nested_info(data, key: Literal["mission", "project"]) -> Tuple[UUID, str]:
    nested_data = data[key]
    return (
        UUID(nested_data[ProjectObjectKeys.UUID], version=4),
        nested_data[ProjectObjectKeys.NAME],
    )


def _parse_datetime(date: str) -> datetime:
    try:
        return dateutil.parser.isoparse(date)
    except ValueError as e:
        raise ParsingError(f"error parsing date: {date}") from e


def _parse_file_state(state: str) -> FileState:
    try:
        return FileState(state)
    except ValueError as e:
        raise ParsingError(f"error parsing file state: {state}") from e


def _parse_metadata(tags: List[Dict]) -> Dict[str, MetadataValue]:
    result = {}
    try:
        for tag in tags:
            entry = {tag.get("name"): MetadataValue(tag.get("valueAsString"), tag.get("datatype"))}
            result.update(entry)
        return result
    except ValueError as e:
        raise ParsingError(f"error parsing metadata: {e}") from e


def _parse_required_tags(tags: List[Dict]) -> list[str]:
    return list(_parse_metadata(tags).keys())


def _parse_project(project_object: ProjectObject) -> Project:
    try:
        id_ = UUID(project_object[ProjectObjectKeys.UUID], version=4)
        name = project_object[ProjectObjectKeys.NAME]
        description = project_object[ProjectObjectKeys.DESCRIPTION]
        created_at = _parse_datetime(project_object[ProjectObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(project_object[ProjectObjectKeys.UPDATED_AT])
        required_tags = _parse_required_tags(project_object[ProjectObjectKeys.REQUIRED_TAGS])
    except Exception as e:
        raise ParsingError(f"error parsing project: {project_object}") from e
    return Project(
        id=id_,
        name=name,
        description=description,
        created_at=created_at,
        updated_at=updated_at,
        required_tags=required_tags,
    )


def _parse_mission(mission: MissionObject) -> Mission:
    try:
        id_ = UUID(mission[MissionObjectKeys.UUID], version=4)
        name = mission[MissionObjectKeys.NAME]
        created_at = _parse_datetime(mission[MissionObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(mission[MissionObjectKeys.UPDATED_AT])
        metadata = _parse_metadata(mission[MissionObjectKeys.TAGS])
        file_count = mission[MissionObjectKeys.FILECOUNT]
        filesize = mission[MissionObjectKeys.FILESIZE]

        project_id, project_name = _get_nested_info(mission, PROJECT)

        parsed = Mission(
            id=id_,
            name=name,
            created_at=created_at,
            updated_at=updated_at,
            metadata=metadata,
            project_id=project_id,
            project_name=project_name,
            number_of_files=file_count,
            size=filesize,
        )
    except Exception as e:
        raise ParsingError(f"error parsing mission: {mission}") from e
    return parsed


def _parse_file(file: FileObject) -> File:
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
        categories = file[FileObjectKeys.CATEGORIES]

        mission_id, mission_name = _get_nested_info(file, MISSION)
        project_id, project_name = _get_nested_info(file[MISSION], PROJECT)

        parsed = File(
            id=id_,
            name=name,
            hash=fhash,
            size=fsize,
            type_=ftype,
            date=fdate,
            categories=categories,
            state=state,
            created_at=created_at,
            updated_at=updated_at,
            mission_id=mission_id,
            mission_name=mission_name,
            project_id=project_id,
            project_name=project_name,
        )
    except Exception as e:
        raise ParsingError(f"error parsing file: {file}") from e
    return parsed


def _parse_action_template(run_object: RunObject) -> ActionTemplate:
    try:
        uuid_ = UUID(run_object[TemplateObjectKeys.UUID], version=4)
        access_rights = run_object[TemplateObjectKeys.ACCESS_RIGHTS]
        command = run_object[TemplateObjectKeys.COMMAND]
        cpu_cores = run_object[TemplateObjectKeys.CPU_CORES]
        cpu_memory_gb = run_object[TemplateObjectKeys.CPU_MEMORY_GB]
        entrypoint = run_object[TemplateObjectKeys.ENTRYPOINT]
        gpu_memory_gb = run_object[TemplateObjectKeys.GPU_MEMORY_GB]
        image_name = run_object[TemplateObjectKeys.IMAGE_NAME]
        max_runtime_minutes = run_object[TemplateObjectKeys.MAX_RUNTIME_MINUTES]
        created_at = _parse_datetime(run_object[TemplateObjectKeys.CREATED_AT])
        name = run_object[TemplateObjectKeys.NAME]
        version = run_object[TemplateObjectKeys.VERSION]

    except Exception as e:
        raise ParsingError(f"error parsing action template: {run_object}") from e

    return ActionTemplate(
        uuid=uuid_,
        access_rights=access_rights,
        command=command,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        entrypoint=entrypoint,
        gpu_memory_gb=gpu_memory_gb,
        image_name=image_name,
        max_runtime_minutes=max_runtime_minutes,
        created_at=created_at,
        name=name,
        version=version,
    )


def _parse_run(run_object: RunObject) -> Run:
    try:
        uuid_ = UUID(run_object[RunObjectKeys.UUID], version=4)
        state = run_object[RunObjectKeys.STATE]
        state_cause = run_object[RunObjectKeys.STATE_CAUSE]
        artifact_url = run_object.get(RunObjectKeys.ARTIFACT_URL)
        created_at = _parse_datetime(run_object[RunObjectKeys.CREATED_AT])
        updated_at = (
            _parse_datetime(run_object[RunObjectKeys.UPDATED_AT]) if run_object.get(RunObjectKeys.UPDATED_AT) else None
        )

        mission_dict = run_object[RunObjectKeys.MISSION]
        mission_id = UUID(mission_dict[MissionObjectKeys.UUID], version=4)
        mission_name = mission_dict[MissionObjectKeys.NAME]

        project_dict = mission_dict[PROJECT]
        project_name = project_dict[ProjectObjectKeys.NAME]

        template_dict = run_object[RunObjectKeys.TEMPLATE]
        template_id = UUID(template_dict[TemplateObjectKeys.UUID], version=4)
        template_name = template_dict[TemplateObjectKeys.NAME]
        logs = []
        for log_entry in run_object.get(RunObjectKeys.LOGS, []):
            log_timestamp = _parse_datetime(log_entry[LogEntryObjectKeys.TIMESTAMP])
            log_level = log_entry[LogEntryObjectKeys.LEVEL]
            log_message = log_entry[LogEntryObjectKeys.MESSAGE]
            logs.append(
                LogEntry(
                    timestamp=log_timestamp,
                    level=log_level,
                    message=log_message,
                )
            )

    except Exception as e:
        raise ParsingError(f"error parsing run: {run_object}") from e

    return Run(
        uuid=uuid_,
        state=state,
        state_cause=state_cause,
        artifact_url=artifact_url,
        created_at=created_at,
        updated_at=updated_at,
        mission_id=mission_id,
        mission_name=mission_name,
        project_name=project_name,
        template_id=template_id,
        template_name=template_name,
        logs=logs,
    )
