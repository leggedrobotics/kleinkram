from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from datetime import datetime
from enum import Enum
from typing import Dict
from typing import List
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


class FileState(str, Enum):
    OK = "OK"
    CORRUPTED = "CORRUPTED"
    UPLOADING = "UPLOADING"
    ERROR = "ERROR"
    CONVERTING = "CONVERTING"
    CONVERSION_ERROR = "CONVERSION_ERROR"
    LOST = "LOST"
    FOUND = "FOUND"


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
