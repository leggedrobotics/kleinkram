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

import dateutil.parser
from rich.console import Console
from rich.table import Table
from rich.text import Text

from kleinkram.config import get_shared_state
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
    FileVerificationStatus.UPLOADED: "green",
    FileVerificationStatus.UPLOADING: "yellow",
    FileVerificationStatus.MISSING: "yellow",
    FileVerificationStatus.MISMATCHED_HASH: "red",
    FileVerificationStatus.MISMATCHED_SIZE: "red",
    FileVerificationStatus.UNKNOWN: "gray",
    FileVerificationStatus.COMPUTING_HASH: "purple",
}


def _add_placeholder_row(table: Table, skipped: int) -> None:
    first_column = f"... ({skipped} more)"
    table.add_row(first_column, *["..." for _ in range(len(table.columns) - 1)])


def file_state_to_text(file_state: FileState) -> Text:
    return Text(file_state.value, style=FILE_STATE_COLOR[file_state])


def file_verification_status_to_text(
    file_verification_status: FileVerificationStatus,
) -> Text:
    return Text(
        file_verification_status.value,
        style=FILE_VERIFICATION_STATUS_STYLES[file_verification_status],
    )


def format_bytes(size: int) -> str:
    """
    Converts a size in bytes to a human-readable string (e.g., KB, MB, GB, TB).

    Args:
        size (int): The size in bytes.

    Returns:
        str: A formatted string representing the size in appropriate units.
    """

    if size < 0:
        raise ValueError("Size must be a non-negative integer")

    # Define units and their thresholds
    units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"]
    index = 0

    fsize: float = size
    while fsize >= 1000 and index < len(units) - 1:
        fsize /= 1000.0
        index += 1

    # Format to 2 decimal places if needed
    if index == 0:  # Bytes don't need decimals
        return f"{int(fsize)} {units[index]}"
    else:
        return f"{fsize:.2f} {units[index]}"


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
        return dateutil.parser.isoparse(value.value)
    assert False, "unreachable"


def projects_to_table(projects: Sequence[Project]) -> Table:
    table = Table(title="projects")
    table.add_column("id")
    table.add_column("name")
    table.add_column("description")

    max_table_size = get_shared_state().max_table_size
    for project in projects[:max_table_size]:
        table.add_row(str(project.id), project.name, project.description)
    if len(projects) > max_table_size:
        _add_placeholder_row(table, skipped=len(projects) - max_table_size)
    return table


def missions_to_table(missions: Sequence[Mission]) -> Table:
    table = Table(title="missions")
    table.add_column("project")
    table.add_column("name")
    table.add_column("id")
    table.add_column("files")
    table.add_column("size")

    # order by project, name
    missions_tp: List[Tuple[str, str, Mission]] = []
    for mission in missions:
        missions_tp.append((mission.project_name, mission.name, mission))
    missions_tp.sort()

    if not missions_tp:
        return table
    last_project: Optional[str] = None
    max_table_size = get_shared_state().max_table_size
    for project, _, mission in missions_tp[:max_table_size]:
        # add delimiter row if project changes
        if last_project is not None and last_project != project:
            table.add_section()
        last_project = project

        table.add_row(
            mission.project_name,
            mission.name,
            str(mission.id),
            str(mission.number_of_files),
            format_bytes(mission.size),
        )

    if len(missions_tp) > max_table_size:
        _add_placeholder_row(table, skipped=len(missions_tp) - max_table_size)
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
    max_table_size = get_shared_state().max_table_size
    for _, mission, _, file in files_tp[:max_table_size]:
        if last_mission is not None and last_mission != mission and delimiters:
            table.add_section()
        last_mission = mission

        table.add_row(
            file.project_name,
            file.mission_name,
            file.name,
            Text(str(file.id), style="green"),
            file_state_to_text(file.state),
            format_bytes(file.size),
            ", ".join(file.categories),
        )

    if len(files_tp) > max_table_size:
        _add_placeholder_row(table, skipped=len(files_tp) - max_table_size)

    return table


def file_info_table(file: File) -> Table:
    table = Table("k", "v", title=f"file info: {file.name}", show_header=False)

    table.add_row("name", file.name)
    table.add_row("id", Text(str(file.id), style="green"))
    table.add_row("project", file.project_name)
    table.add_row("project id", Text(str(file.project_id), style="green"))
    table.add_row("mission", file.mission_name)
    table.add_row("mission id", Text(str(file.mission_id), style="green"))
    table.add_row("created", str(file.created_at))
    table.add_row("updated", str(file.updated_at))
    table.add_row("size", format_bytes(file.size))
    table.add_row("state", file_state_to_text(file.state))
    table.add_row("categories", ", ".join(file.categories))
    table.add_row("topics", ", ".join(file.topics))
    table.add_row("hash", file.hash)
    table.add_row("type", file.type_)
    table.add_row("date", str(file.date))

    return table


def mission_info_table(
    mission: Mission, print_metadata: bool = False
) -> Tuple[Table, ...]:
    table = Table("k", "v", title=f"mission info: {mission.name}", show_header=False)

    # TODO: add more fields as we store more information in the Mission object
    table.add_row("name", mission.name)
    table.add_row("id", Text(str(mission.id), style="green"))
    table.add_row("project", mission.project_name)
    table.add_row("project id", Text(str(mission.project_id), style="green"))
    table.add_row("created", str(mission.created_at))
    table.add_row("updated", str(mission.updated_at))
    table.add_row("size", format_bytes(mission.size))
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
    file_status: Mapping[Path, FileVerificationStatus],
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
        table = file_verification_status_table(file_status)
        Console().print(table)
    else:
        for path, status in file_status.items():
            stream = (
                sys.stdout if status == FileVerificationStatus.UPLOADED else sys.stderr
            )
            print(path, file=stream, flush=True)


def print_files(files: Sequence[File], *, pprint: bool) -> None:
    """\
    prints the files to stdout / stderr
    either using pprint or as a list for piping
    """
    if pprint:
        table = files_to_table(files)
        Console().print(table)
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
        table = missions_to_table(missions)
        Console().print(table)
    else:
        for mission in missions:
            print(mission.id)


def print_projects(projects: Sequence[Project], *, pprint: bool) -> None:
    """\
    prints the projects to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        table = projects_to_table(projects)
        Console().print(table)
    else:
        for project in projects:
            print(project.id)


def print_file_info(file: File, *, pprint: bool) -> None:
    """\
    prints the file info to stdout
    either using pprint or as a list for piping
    """
    if pprint:
        table = file_info_table(file)
        Console().print(table)
    else:
        file_dct = asdict(file)
        for key in file_dct:
            file_dct[key] = str(file_dct[key])  # TODO: improve this
        print(json.dumps(file_dct))


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
