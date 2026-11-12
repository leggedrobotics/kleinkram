from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any
from typing import Dict
from typing import List
from typing import Literal
from typing import Mapping
from typing import NewType
from typing import Optional
from typing import Tuple
from uuid import UUID

import dateutil.parser

from kleinkram.errors import ParsingError
from kleinkram.models import ActionTemplate
from kleinkram.models import ActionTrigger
from kleinkram.models import ArtifactState
from kleinkram.models import Diagnostic
from kleinkram.models import Execution
from kleinkram.models import File
from kleinkram.models import FileConfig
from kleinkram.models import FileState
from kleinkram.models import FileTriggerEvent
from kleinkram.models import LogEntry
from kleinkram.models import MetadataValue
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.models import TimeConfig
from kleinkram.models import TriggerConfig
from kleinkram.models import TriggerType
from kleinkram.models import WebhookConfig
from kleinkram.utils import hours_to_minutes

__all__ = [
    "_parse_project",
    "_parse_mission",
    "_parse_file",
]


ProjectObject = NewType("ProjectObject", Dict[str, Any])
MissionObject = NewType("MissionObject", Dict[str, Any])
FileObject = NewType("FileObject", Dict[str, Any])
ExecutionObject = NewType("ExecutionObject", Dict[str, Any])
TemplateObject = NewType("TemplateObject", Dict[str, Any])
TriggerObject = NewType("TriggerObject", Dict[str, Any])

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
    TOPICS = "topics"
    STATE_COMMENT = "stateComment"


class MissionObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    METADATA = "metadata"
    # deprecated alias of `metadata`, the only key servers before the rename send
    LEGACY_METADATA = "tags"
    FILESIZE = "size"
    FILECOUNT = "filesCount"


class ProjectObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    CREATED_AT = "createdAt"
    UPDATED_AT = "updatedAt"
    REQUIRED_METADATA_TYPES = "requiredMetadataTypes"
    # deprecated alias of `requiredMetadataTypes`, the only key servers before the rename send
    LEGACY_REQUIRED_METADATA_TYPES = "requiredTags"


class ExecutionObjectKeys(str, Enum):
    UUID = "uuid"
    STATE = "state"
    SEVERITY = "severity"
    FAILURE_ORIGIN = "failureOrigin"
    DIAGNOSTIC_COUNT = "diagnosticCount"
    STATE_CAUSE = "stateCause"
    CREATED_AT = "createdAt"
    MISSION = "mission"
    TEMPLATE = "template"
    UPDATED_AT = "updatedAt"
    LOGS = "logs"
    ARTIFACT_URL = "artifactUrl"
    ARTIFACT_STATE = "artifacts"
    ARTIFACT_SIZE = "artifactSize"


class TemplateObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    ACCESS_RIGHTS = "accessRights"
    COMMAND = "command"
    CPU_CORES = "cpuCores"
    CPU_MEMORY_GB = "cpuMemory"
    ENTRYPOINT = "entrypoint"
    GPU_MEMORY_GB = "gpuMemory"
    IMAGE_NAME = "imageName"
    MAX_RUNTIME_HOURS = "maxRuntime"
    CREATED_AT = "createdAt"
    VERSION = "version"


class ActionTriggerObjectKeys(str, Enum):
    UUID = "uuid"
    NAME = "name"
    DESCRIPTION = "description"
    MISSION_UUID = "missionUuid"
    TEMPLATE_NAME = "templateName"
    TEMPLATE_UUID = "templateUuid"
    TYPE = "type"
    CONFIG = "config"
    CREATOR_NAME = "creatorName"
    CREATOR_UUID = "creatorUuid"


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


def _get_with_fallback(data: Mapping[str, Any], key: str, legacy_key: str) -> Any:
    """\
    read `key`, falling back to its pre-rename name for older servers
    """
    if key in data:
        return data[key]
    return data[legacy_key]


def _parse_metadata_type_id(metadata: Dict) -> Optional[UUID]:
    """\
    the uuid of the metadata *type*, not of the metadata value itself

    `MetadataDto` exposes it under `type`; the raw entity uses `metadataType`
    (`tagType` on servers before the rename).
    """
    type_object = metadata.get("type") or metadata.get("metadataType") or metadata.get("tagType")
    if not isinstance(type_object, dict):
        return None

    raw = type_object.get("uuid")
    if raw is None:
        return None

    try:
        return UUID(str(raw), version=4)
    except ValueError as e:
        raise ParsingError(f"error parsing metadata type uuid: {raw}") from e


def _parse_metadata_value(metadata: Dict) -> MetadataValue:
    raw = metadata.get("valueAsString")
    if raw is None:
        # `valueAsString` is a plain getter on the API DTO and is therefore not
        # part of the serialized response (see #2360); the value is carried by
        # the `value` key instead.
        raw = metadata.get("value")

    if isinstance(raw, bool):
        # JSON booleans would stringify to "True"/"False", which neither the
        # API nor `parse_metadata_value` understands.
        value = "true" if raw else "false"
    elif raw is None:
        value = ""
    else:
        value = str(raw)

    return MetadataValue(value, metadata.get("datatype"), _parse_metadata_type_id(metadata))


def _parse_metadata(metadata: List[Dict]) -> Dict[str, MetadataValue]:
    result = {}
    try:
        for entry in metadata:
            result[entry.get("name")] = _parse_metadata_value(entry)
        return result
    except ValueError as e:
        raise ParsingError(f"error parsing metadata: {e}") from e


def _parse_required_metadata_types(metadata_types: List[Dict]) -> list[str]:
    return list(_parse_metadata(metadata_types).keys())


def _parse_project(project_object: ProjectObject) -> Project:
    try:
        id_ = UUID(project_object[ProjectObjectKeys.UUID], version=4)
        name = project_object[ProjectObjectKeys.NAME]
        description = project_object[ProjectObjectKeys.DESCRIPTION]
        created_at = _parse_datetime(project_object[ProjectObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(project_object[ProjectObjectKeys.UPDATED_AT])
        required_metadata_types = _parse_required_metadata_types(
            _get_with_fallback(
                project_object,
                ProjectObjectKeys.REQUIRED_METADATA_TYPES,
                ProjectObjectKeys.LEGACY_REQUIRED_METADATA_TYPES,
            )
        )
    except Exception as e:
        raise ParsingError(f"error parsing project: {project_object}") from e
    return Project(
        id=id_,
        name=name,
        description=description,
        created_at=created_at,
        updated_at=updated_at,
        required_metadata_types=required_metadata_types,
    )


def _parse_mission(mission: MissionObject) -> Mission:
    try:
        id_ = UUID(mission[MissionObjectKeys.UUID], version=4)
        name = mission[MissionObjectKeys.NAME]
        created_at = _parse_datetime(mission[MissionObjectKeys.CREATED_AT])
        updated_at = _parse_datetime(mission[MissionObjectKeys.UPDATED_AT])
        metadata = _parse_metadata(_get_with_fallback(mission, MissionObjectKeys.METADATA, MissionObjectKeys.LEGACY_METADATA))
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


def _parse_names(objects: List[Any]) -> List[str]:
    """\
    extract the names of a list of named objects (e.g. categories or topics)
    as returned by the api; plain strings are passed through
    """
    return [obj["name"] if isinstance(obj, dict) and "name" in obj else str(obj) for obj in objects]


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
        state_comment = file.get(FileObjectKeys.STATE_COMMENT)
        categories = _parse_names(file.get(FileObjectKeys.CATEGORIES) or [])

        # only the single file endpoint returns topics, listing files does not
        topics = _parse_names(file.get(FileObjectKeys.TOPICS) or [])

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
            topics=topics,
            state=state,
            state_comment=state_comment,
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


def _parse_action_template(template_object: TemplateObject) -> ActionTemplate:
    try:
        uuid = UUID(template_object[TemplateObjectKeys.UUID], version=4)
        access_rights = template_object[TemplateObjectKeys.ACCESS_RIGHTS]
        command = template_object[TemplateObjectKeys.COMMAND]
        cpu_cores = template_object[TemplateObjectKeys.CPU_CORES]
        cpu_memory_gb = template_object[TemplateObjectKeys.CPU_MEMORY_GB]
        description = template_object[TemplateObjectKeys.DESCRIPTION]
        entrypoint = template_object[TemplateObjectKeys.ENTRYPOINT]
        gpu_memory_gb = template_object[TemplateObjectKeys.GPU_MEMORY_GB]
        image_name = template_object[TemplateObjectKeys.IMAGE_NAME]
        # the backend reports the runtime limit in hours
        max_runtime_minutes = hours_to_minutes(template_object[TemplateObjectKeys.MAX_RUNTIME_HOURS])
        created_at = _parse_datetime(template_object[TemplateObjectKeys.CREATED_AT])
        name = template_object[TemplateObjectKeys.NAME]
        version = template_object[TemplateObjectKeys.VERSION]

    except Exception as e:
        raise ParsingError(f"error parsing action template: {template_object}") from e

    return ActionTemplate(
        uuid=uuid,
        access_rights=access_rights,
        command=command,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        description=description,
        entrypoint=entrypoint,
        gpu_memory_gb=gpu_memory_gb,
        image_name=image_name,
        max_runtime_minutes=max_runtime_minutes,
        created_at=created_at,
        name=name,
        version=version,
    )


def _parse_diagnostic(diagnostic_object: Dict[str, Any]) -> Diagnostic:
    try:
        return Diagnostic(
            uuid=UUID(diagnostic_object["uuid"], version=4),
            severity=diagnostic_object["severity"],
            message=diagnostic_object["message"],
            code=diagnostic_object.get("code"),
            file=diagnostic_object.get("file"),
            count=diagnostic_object.get("count", 1),
            created_at=_parse_datetime(diagnostic_object["createdAt"]),
        )
    except Exception as e:
        raise ParsingError(f"error parsing diagnostic: {diagnostic_object}") from e


def _parse_execution(execution_object: ExecutionObject) -> Execution:
    try:
        uuid = UUID(execution_object[ExecutionObjectKeys.UUID], version=4)
        state = execution_object[ExecutionObjectKeys.STATE]
        # Optional: a backend older than the severity feature omits these.
        severity = execution_object.get(ExecutionObjectKeys.SEVERITY)
        failure_origin = execution_object.get(ExecutionObjectKeys.FAILURE_ORIGIN)
        diagnostic_count = execution_object.get(ExecutionObjectKeys.DIAGNOSTIC_COUNT) or 0
        state_cause = execution_object[ExecutionObjectKeys.STATE_CAUSE]
        artifact_url = execution_object.get(ExecutionObjectKeys.ARTIFACT_URL)
        raw_state = execution_object.get(ExecutionObjectKeys.ARTIFACT_STATE)
        artifact_state = ArtifactState(raw_state) if raw_state is not None else None
        artifact_size = execution_object.get(ExecutionObjectKeys.ARTIFACT_SIZE)
        created_at = _parse_datetime(execution_object[ExecutionObjectKeys.CREATED_AT])
        updated_at = (
            _parse_datetime(execution_object[ExecutionObjectKeys.UPDATED_AT])
            if execution_object.get(ExecutionObjectKeys.UPDATED_AT)
            else None
        )

        mission_dict = execution_object[ExecutionObjectKeys.MISSION]
        mission_id = UUID(mission_dict[MissionObjectKeys.UUID], version=4)
        mission_name = mission_dict[MissionObjectKeys.NAME]

        project_dict = mission_dict[PROJECT]
        project_name = project_dict[ProjectObjectKeys.NAME]

        template_dict = execution_object[ExecutionObjectKeys.TEMPLATE]
        template_id = UUID(template_dict[TemplateObjectKeys.UUID], version=4)
        template_name = template_dict[TemplateObjectKeys.NAME]
        logs = []
        for log_entry in execution_object.get(ExecutionObjectKeys.LOGS, []):
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
        raise ParsingError(f"error parsing run: {execution_object}") from e

    return Execution(
        uuid=uuid,
        state=state,
        severity=severity,
        failure_origin=failure_origin,
        diagnostic_count=diagnostic_count,
        state_cause=state_cause,
        artifact_url=artifact_url,
        artifact_state=artifact_state,
        artifact_size=artifact_size,
        created_at=created_at,
        updated_at=updated_at,
        mission_id=mission_id,
        mission_name=mission_name,
        project_name=project_name,
        template_id=template_id,
        template_name=template_name,
        logs=logs,
    )


def _parse_action_trigger(trigger_object: TriggerObject) -> ActionTrigger:
    try:
        uuid = UUID(trigger_object[ActionTriggerObjectKeys.UUID], version=4)
        name = trigger_object[ActionTriggerObjectKeys.NAME]
        description = trigger_object[ActionTriggerObjectKeys.DESCRIPTION]
        mission_uuid = UUID(trigger_object[ActionTriggerObjectKeys.MISSION_UUID], version=4)
        template_uuid = UUID(trigger_object[ActionTriggerObjectKeys.TEMPLATE_UUID], version=4)
        template_name = trigger_object[ActionTriggerObjectKeys.TEMPLATE_NAME]
        type_ = TriggerType(trigger_object[ActionTriggerObjectKeys.TYPE])
        creator_name = trigger_object[ActionTriggerObjectKeys.CREATOR_NAME]
        creator_uuid = UUID(trigger_object[ActionTriggerObjectKeys.CREATOR_UUID], version=4)

        config: TriggerConfig
        if type_ is TriggerType.FILE:
            raw_config = trigger_object[ActionTriggerObjectKeys.CONFIG]
            config = FileConfig(
                patterns=tuple(raw_config.get("patterns") or ()),
                event=tuple(FileTriggerEvent(e) for e in raw_config.get("event")) if raw_config.get("event") else (),
            )
        elif type_ is TriggerType.TIME:
            config = TimeConfig(**trigger_object[ActionTriggerObjectKeys.CONFIG])
        elif type_ is TriggerType.WEBHOOK:
            config = WebhookConfig(**trigger_object[ActionTriggerObjectKeys.CONFIG])
        else:
            raise ParsingError(f"unknown trigger type: {type_}")

    except Exception as e:
        raise ParsingError(f"error parsing action trigger: {trigger_object}") from e

    return ActionTrigger(
        uuid=uuid,
        name=name,
        description=description,
        mission_uuid=mission_uuid,
        template_uuid=template_uuid,
        template_name=template_name,
        type=type_,
        creator_name=creator_name,
        creator_uuid=creator_uuid,
        config=config,
    )
