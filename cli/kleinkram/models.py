from __future__ import annotations

from typing import List, Dict, Any, Optional, NamedTuple
from uuid import UUID
from enum import Enum

from rich.table import Table


class Project(NamedTuple):
    id: UUID
    name: str
    description: str


def projects_to_table(projects: List[Project]) -> Table:
    table = Table(title="Projects")
    table.add_column("ID")
    table.add_column("Name")
    table.add_column("Description")

    for project in projects:
        table.add_row(str(project.id), project.name, project.description)

    return table


class Mission(NamedTuple):
    id: UUID
    name: str
    description: str
    project_id: UUID


class User(NamedTuple):
    id: UUID
    name: str
    email: str
    role: str


class DataType(Enum, str):
    LOCATION = "LOCATION"
    STRING = "STRING"
    LINK = "LINK"
    BOOLEAN = "BOOLEAN"
    NUMBER = "NUMBER"
    DATE = "DATE"


class TagType(NamedTuple):
    name: str
    data_type: DataType
    id: Optional[UUID] = None


def tag_types_table(tag_types: list[TagType], verbose: bool = False) -> Table:
    table = Table(title="Tag Types")
    table.add_column("Name")
    table.add_column("Data Type")

    if verbose:
        table.add_column("UUID")

    for tagtype in tag_types:
        entries = [tagtype.name, tagtype.data_type.value]
        if verbose:
            entries.append(str(tagtype.id))
        table.add_row(*entries)

    return table
