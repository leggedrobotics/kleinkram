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


# this is the file state for the verify command
class FileVerificationStatus(str, Enum):
    UPLOADED = "uploaded"
    UPLOADING = "uploading"
    COMPUTING_HASH = "computing hash"
    MISSING = "missing"
    MISMATCHED_HASH = "hash mismatch"
    MISMATCHED_SIZE = "size mismatch"
    UNKNOWN = "unknown"
