from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from datetime import datetime
from enum import Enum
from enum import IntEnum
from typing import Any
from typing import Dict
from typing import List
from typing import Mapping
from typing import Optional
from typing import Tuple
from typing import Union
from uuid import UUID


class MetadataValueType(str, Enum):
    LOCATION = "LOCATION"  # string
    STRING = "STRING"  # string
    LINK = "LINK"  # string
    BOOLEAN = "BOOLEAN"  # bool
    NUMBER = "NUMBER"  # float
    DATE = "DATE"  # datetime


@dataclass(frozen=True)
class MetadataValue:
    value: str
    type_: MetadataValueType

    # uuid of the metadata type this value belongs to, as reported by the API;
    # `None` when the response did not carry it. Metadata type *names* are not
    # a safe key: resolving one goes through a substring search.
    type_id: Optional[UUID] = None


# a metadata value as it is sent to the API; numbers and booleans are sent as
# native JSON values so the API does not have to parse them out of a string
MetadataPayloadValue = Union[str, float, bool]


class FileState(str, Enum):
    OK = "OK"
    CORRUPTED = "CORRUPTED"
    UPLOADING = "UPLOADING"
    ERROR = "ERROR"
    CONVERTING = "CONVERTING"
    CONVERSION_ERROR = "CONVERSION_ERROR"
    LOST = "LOST"
    FOUND = "FOUND"
    CANCELED = "CANCELED"


@dataclass(frozen=True)
class Project:
    id: UUID
    name: str
    description: str
    created_at: datetime
    updated_at: datetime
    required_tags: List[str]


@dataclass(frozen=True)
class Mission:
    id: UUID
    name: str
    created_at: datetime
    updated_at: datetime
    project_id: UUID
    project_name: str
    metadata: Dict[str, MetadataValue] = field(default_factory=dict)
    number_of_files: int = 0
    size: int = 0


@dataclass(frozen=True)
class File:
    id: UUID
    name: str
    hash: str
    size: int
    type_: str
    date: datetime
    created_at: datetime
    updated_at: datetime
    mission_id: UUID
    mission_name: str
    project_id: UUID
    project_name: str
    categories: List[str] = field(default_factory=list)
    topics: List[str] = field(default_factory=list)
    state: FileState = FileState.OK


class ExecutionStatus(str, Enum):
    QUEUED = "Queued"
    IN_PROGRESS = "In Progress"
    SUCCESS = "Success"
    FAILED = "Failed"
    CANCELLED = "Cancelled"


class ArtifactState(IntEnum):
    AWAITING_ACTION = 10
    UPLOADING = 20
    UPLOADED = 30
    ERROR = 40
    EXPIRED = 50


@dataclass(frozen=True)
class LogEntry:
    timestamp: datetime
    level: str
    message: str


@dataclass(frozen=True)
class Execution:
    uuid: UUID
    state: str
    state_cause: str | None
    artifact_url: str | None
    artifact_state: ArtifactState | None
    artifact_size: int | None
    created_at: datetime
    updated_at: datetime | None
    project_name: str
    mission_id: UUID
    mission_name: str
    template_id: UUID
    template_name: str
    logs: List[LogEntry] = field(default_factory=list)


@dataclass(frozen=True)
class ActionTemplate:
    uuid: UUID
    access_rights: int
    command: str
    cpu_cores: int
    cpu_memory_gb: int
    description: str
    entrypoint: str
    gpu_memory_gb: int
    image_name: str
    max_runtime_minutes: int
    created_at: datetime
    name: str
    version: str


# this is the file state for the verify command
class FileVerificationStatus(str, Enum):
    UPLOADED = "uploaded"
    UPLOADING = "uploading"
    COMPUTING_HASH = "computing hash"
    MISSING = "missing"
    MISMATCHED_HASH = "hash mismatch"
    MISMATCHED_SIZE = "size mismatch"
    UNKNOWN = "unknown"


class TriggerType(str, Enum):
    FILE = "FILE"
    WEBHOOK = "WEBHOOK"
    TIME = "TIME"


class FileTriggerEvent(str, Enum):
    UPLOAD = "UPLOAD"
    RENAME = "RENAME"
    MOVE = "MOVE"
    DELETE = "DELETE"


# ---
# The attribute names of the following Config dataclasses match the keys of
# the corresponding API objects, which allows for easy parsing. Thus, if the
# key names of the API objects change, the attribute names of the dataclasses
# should be updated accordingly.
# ---


@dataclass(frozen=True)
class FileConfig:
    patterns: Tuple[str, ...] = field(default_factory=tuple)
    event: Tuple[FileTriggerEvent, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class TimeConfig:
    cron: str


# placeholder for future config options
@dataclass(frozen=True)
class WebhookConfig:
    extra_options: Mapping[str, Any] = field(default_factory=dict)


TriggerConfig = FileConfig | TimeConfig | WebhookConfig


@dataclass(frozen=True)
class ActionTrigger:
    uuid: UUID
    name: str
    description: str
    template_uuid: UUID
    template_name: Optional[str]
    mission_uuid: UUID
    type: TriggerType
    config: TriggerConfig
    creator_name: str
    creator_uuid: UUID
