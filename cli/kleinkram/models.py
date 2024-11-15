from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from typing import Union
from uuid import UUID

from rich.table import Table
from rich.text import Text


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


class FileState(str, Enum):
    OK = "OK"
    CORRUPTED = "CORRUPTED"
    UPLOADING = "UPLOADING"
    ERROR = "ERROR"
    CONVERSION_ERROR = "CONVERSION_ERROR"
    LOST = "LOST"
    FOUND = "FOUND"


FILE_STATE_COLOR = {
    FileState.OK: "green",
    FileState.CORRUPTED: "red",
    FileState.UPLOADING: "yellow",
    FileState.ERROR: "red",
    FileState.CONVERSION_ERROR: "red",
    FileState.LOST: "bold red",
    FileState.FOUND: "yellow",
}


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
    state: FileState = FileState.OK


class DataType(str, Enum):
    LOCATION = "LOCATION"
    STRING = "STRING"
    LINK = "LINK"
    BOOLEAN = "BOOLEAN"
    NUMBER = "NUMBER"
    DATE = "DATE"


@dataclass(frozen=True, eq=True)
class TagType:
    name: str
    id: UUID
    data_type: DataType
    description: Optional[str]


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
    missions_tp: List[Tuple[str, str, Mission]] = []
    for mission in missions:
        missions_tp.append((mission.project_name, mission.name, mission))
    missions_tp.sort()

    if not missions_tp:
        return table
    last_project: Optional[str] = None
    for project, _, mission in missions_tp:
        # add delimiter row if project changes
        if last_project is not None and last_project != project:
            table.add_row()
        last_project = project

        table.add_row(mission.project_name, mission.name, str(mission.id))

    return table


def files_to_table(
    files: List[File], *, title: str = "files", delimiters: bool = True
) -> Table:
    table = Table(title=title)
    table.add_column("project")
    table.add_column("mission")
    table.add_column("name")
    table.add_column("id")
    table.add_column("state")

    # order by project, mission, name
    files_tp: List[Tuple[str, str, str, File]] = []
    for file in files:
        files_tp.append((file.project_name, file.mission_name, file.name, file))
    files_tp.sort()

    if not files_tp:
        return table

    last_mission: Optional[str] = None
    for _, mission, _, file in files_tp:
        if last_mission is not None and last_mission != mission and delimiters:
            table.add_row()
        last_mission = mission

        table.add_row(
            file.project_name,
            file.mission_name,
            file.name,
            Text(str(file.id), style="green"),
            Text(file.state.value, style=FILE_STATE_COLOR[file.state]),
        )

    return table


class FilesById(NamedTuple):
    ids: List[UUID]


class FilesByMission(NamedTuple):
    mission: MissionById | MissionByName
    files: List[Union[str, UUID]]


class MissionById(NamedTuple):
    id: UUID


class MissionByName(NamedTuple):
    name: str
    project: Union[str, UUID]
