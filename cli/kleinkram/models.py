from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from pathlib import Path
from typing import List
from typing import NamedTuple
from typing import Optional
from uuid import UUID

from rich.table import Table


@dataclass(frozen=True, eq=True)
class Project:
    id: UUID
    name: str
    description: str
    missions: List[Mission] = field(default_factory=list)


@dataclass(frozen=True, eq=True)
class Mission:
    id: UUID
    name: str
    project_id: UUID
    project_name: str
    files: List[File] = field(default_factory=list)


@dataclass(frozen=True, eq=True)
class File:
    id: UUID
    name: str
    hash: str
    size: int
    mission_id: UUID
    mission_name: str
    project_id: UUID
    project_name: str


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


def delimiter_row(
    *lengths: int, delimiter: str = "-", cols: list[int] | None = None
) -> List[str]:
    ret = []
    for i, col_len in enumerate(lengths):
        if cols is None or i in cols:
            ret.append(delimiter * col_len)
        else:
            ret.append("")
    return ret


def projects_to_table(projects: List[Project]) -> Table:
    table = Table(title="projects")
    table.add_column("id")
    table.add_column("name")
    table.add_column("description")

    for project in projects:
        table.add_row(str(project.id), project.name, project.description)

    return table


def missions_to_table(missions: List[Mission]) -> Table:
    table = Table(title="missions")
    table.add_column("project")
    table.add_column("name")
    table.add_column("id")

    # order by project, name
    missions_tp = []
    for mission in missions:
        missions_tp.append((mission.project_name, mission.name, str(mission.id)))
    missions_tp.sort()

    # this is used to place table delimiters
    # somehow this is not supported out of the box by rich
    pmax = max(len(x[0]) for x in missions_tp)
    nmax = max(len(x[1]) for x in missions_tp)
    imax = max(len(x[2]) for x in missions_tp)

    last_project: Optional[str] = None
    for project, name, id_ in missions_tp:
        # add delimiter row if project changes
        if last_project is not None and last_project != project:
            table.add_row(*delimiter_row(pmax, nmax, imax, delimiter="="))
        last_project = project

        table.add_row(project, name, id_)
    return table


def files_to_table(
    files: List[File], *, title: str = "files", delimiters: bool = True
) -> Table:
    table = Table(title="files")
    table.add_column("project")
    table.add_column("mission")
    table.add_column("name")
    table.add_column("id")

    # order by project, mission, name
    files_tp = []
    for file in files:
        files_tp.append((file.project_name, file.mission_name, file.name, str(file.id)))
    files_tp.sort()

    # this is used to place table delimiters
    # somehow this is not supported out of the box by rich
    pmax = max(len(x[0]) for x in files_tp)
    mmax = max(len(x[1]) for x in files_tp)
    nmax = max(len(x[2]) for x in files_tp)
    imax = max(len(x[3]) for x in files_tp)

    last_mission: Optional[str] = None
    last_project: Optional[str] = None
    for project, mission, name, id_ in files_tp:
        # add delimiter row if project or mission changes
        if last_project is not None and last_project != project and delimiters:
            table.add_row(*delimiter_row(pmax, mmax, nmax, imax, delimiter="="))
        elif last_mission is not None and last_mission != mission and delimiters:
            table.add_row()
        last_project = project
        last_mission = mission

        table.add_row(project, mission, name, id_)

    return table
