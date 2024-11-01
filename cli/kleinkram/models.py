from __future__ import annotations

from enum import Enum
from typing import Any
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Optional
from uuid import UUID
import sys

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


class DataType(str, Enum):
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


class File(NamedTuple):
    id: UUID
    name: str
    mission_id: UUID
    mission_name: str
    project_id: UUID
    project_name: str


def print_files(file: List[File]) -> None:
    tree = {}
    for f in file:
        if f.project_id not in tree:
            tree[f.project_id] = {}
        if f.mission_id not in tree[f.project_id]:
            tree[f.project_id][f.mission_id] = []
        tree[f.project_id][f.mission_id].append(f)

    pmap = {f.project_id: f.project_name for f in file}
    mmap = {f.mission_id: f.mission_name for f in file}

    print("Files:")
    for project_id, missions in tree.items():
        print(f" -  Project: {pmap[project_id]} ({project_id})")
        for mission_id, files in missions.items():
            print(f"   - Mission: {mmap[mission_id]} ({mission_id})")
            for f in files:
                print(f"     - {f.name} ({f.id})")
