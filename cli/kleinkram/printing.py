from __future__ import annotations

import json
import sys
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import List
from typing import Mapping
from typing import Optional
from typing import Sequence
from typing import Tuple
from typing import Union

from rich.console import Console
from rich.layout import Layout
from rich.table import Table
from rich.text import Text

from kleinkram.core import FileVerificationStatus
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.models import MetadataValue
from kleinkram.models import MetadataValueType
from kleinkram.models import Mission
from kleinkram.models import Project

FILE_STATE_COLOR = {
    FileState.OK: "green",
    FileState.CORRUPTED: "red",
    FileState.UPLOADING: "yellow",
    FileState.ERROR: "red",
    FileState.CONVERSION_ERROR: "red",
    FileState.LOST: "bold red",
    FileState.FOUND: "yellow",
}


FILE_VERIFICATION_STATUS_STYLES = {
    FileVerificationStatus.UPLAODED: "green",
    FileVerificationStatus.UPLOADING: "yellow",
    FileVerificationStatus.MISSING: "yellow",
    FileVerificationStatus.MISMATCHED_HASH: "red",
    FileVerificationStatus.UNKNOWN: "gray",
    FileVerificationStatus.COMPUTING_HASH: "purple",
}


def file_state_to_text(file_state: FileState) -> Text:
    return Text(file_state.value, style=FILE_STATE_COLOR[file_state])


def file_verification_status_to_text(
    file_verification_status: FileVerificationStatus,
) -> Text:
    return Text(
        file_verification_status.value,
        style=FILE_VERIFICATION_STATUS_STYLES[file_verification_status],
    )


MetadataValueInternalType = Union[str, float, bool, datetime]


def parse_metadata_value(value: MetadataValue) -> Union[str, float, bool, datetime]:
    if value.type_ in [
        MetadataValueType.STRING,
        MetadataValueType.LINK,
        MetadataValueType.LOCATION,
    ]:
        return value.value
    if value.type_ == MetadataValueType.NUMBER:
        return float(value.value)
    if value.type_ == MetadataValueType.BOOLEAN:
        return value.value == "true"
    if value.type_ == MetadataValueType.DATE:
        return datetime.fromisoformat(value.value)
    assert False, "unreachable"


def projects_to_table(projects: Sequence[Project]) -> Table:
    table = Table(title="projects")
    table.add_column("id")
    table.add_column("name")
    table.add_column("description")

    for project in projects:
        table.add_row(str(project.id), project.name, project.description)
    return table


def missions_to_table(missions: Sequence[Mission]) -> Table:
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
    files: Sequence[File], *, title: str = "files", delimiters: bool = True
) -> Table:
    table = Table(title=title)
    table.add_column("project")
    table.add_column("mission")
    table.add_column("name")
    table.add_column("id")
    table.add_column("state")
    table.add_column("size")
    table.add_column("categories")

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
            file_state_to_text(file.state),
            str(file.size),
            ", ".join(file.categories),
        )
    return table


def mission_info_table(
    mission: Mission, print_metadata: bool = False
) -> Tuple[Table, ...]:
    table = Table("k", "v", title=f"mission info: {mission.name}", show_header=False)

    # TODO: add more fields as we store more information in the Mission object
    table.add_row("id", Text(str(mission.id), style="green"))
    table.add_row("name", mission.name)
    table.add_row("project", mission.project_name)
    table.add_row("project id", Text(str(mission.project_id), style="green"))
    table.add_row("created", str(mission.created_at))
    table.add_row("updated", str(mission.updated_at))
    table.add_row("size", str(mission.size))
    table.add_row("files", str(mission.number_of_files))

    if not print_metadata:
        return (table,)

    metadata_table = Table("k", "v", title="mission metadata", show_header=False)
    kv_pairs_sorted = sorted(
        [(k, v) for k, v in mission.metadata.items()], key=lambda x: x[0]
    )
    for k, v in kv_pairs_sorted:
        metadata_table.add_row(k, str(parse_metadata_value(v)))

    return table, metadata_table


def project_info_table(project: Project) -> Table:
    table = Table("k", "v", title=f"project info: {project.name}", show_header=False)

    # TODO: add more fields as we store more information in the Project object
    table.add_row("id", Text(str(project.id), style="green"))
    table.add_row("name", project.name)
    table.add_row("description", project.description)
    table.add_row("created", str(project.created_at))
    table.add_row("updated", str(project.updated_at))

    return table


def file_verification_status_table(
    file_status: Mapping[Path, FileVerificationStatus]
) -> Table:
    table = Table(title="file status")
    table.add_column("filename", style="cyan")
    table.add_column("status", style="green")
    for path, status in file_status.items():
        table.add_row(str(path), file_verification_status_to_text(status))
    return table


def print_file_verification_status(
    file_status: Mapping[Path, FileVerificationStatus], *, pprint: bool
) -> None:
    """\
    prints the file verification status to stdout / stderr
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(file_verification_status_table(file_status))
    else:
        for path, status in file_status.items():
            stream = (
                sys.stdout if status == FileVerificationStatus.UPLAODED else sys.stderr
            )
            print(path, file=stream, flush=True)


def print_files(files: Sequence[File], *, pprint: bool) -> None:
    """\
    prints the files to stdout / stderr
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(files_to_table(files))
    else:
        for file in files:
            stream = sys.stdout if file.state == FileState.OK else sys.stderr
            print(file.id, file=stream, flush=True)


def print_missions(missions: Sequence[Mission], *, pprint: bool) -> None:
    """\
    prints the missions to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(missions_to_table(missions))
    else:
        for mission in missions:
            print(mission.id)


def print_projects(projects: Sequence[Project], *, pprint: bool) -> None:
    """\
    prints the projects to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(projects_to_table(projects))
    else:
        for project in projects:
            print(project.id)


def print_mission_info(mission: Mission, *, pprint: bool) -> None:
    """\
    prints the mission info to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(*mission_info_table(mission, print_metadata=True))
    else:
        mission_dct = asdict(mission)
        for key in mission_dct:
            mission_dct[key] = str(mission_dct[key])  # TODO: improve this
        print(json.dumps(mission_dct))


def print_project_info(project: Project, *, pprint: bool) -> None:
    """\
    prints the project info to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        Console().print(project_info_table(project))
    else:
        project_dct = asdict(project)
        for key in project_dct:
            project_dct[key] = str(project_dct[key])  # TODO: improve this
        print(json.dumps(project_dct))
