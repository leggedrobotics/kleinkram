from __future__ import annotations

from enum import Enum


class PermissionLevel(Enum):
    READ = 0
    CREATE = 10
    WRITE = 20
    DELETE = 30
