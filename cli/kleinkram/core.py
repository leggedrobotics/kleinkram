"""
contains all the core functionality of the kleinkram python package
"""

from __future__ import annotations

from logging import getLogger
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from typing import Union
from typing import overload
from uuid import UUID

from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import download_files as _download_files
from kleinkram.api.file_transfer import upload_files
from kleinkram.api.routes import _delete_files
from kleinkram.api.routes import _delete_mission
from kleinkram.api.routes import _delete_project
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionNotFound
from kleinkram.errors import ProjectNotFound
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.models import files_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.resources import check_mission_spec_is_creatable
from kleinkram.resources import check_project_spec_is_creatable
from kleinkram.resources import get_files
from kleinkram.resources import get_mission
from kleinkram.resources import get_missions
from kleinkram.resources import get_project
from kleinkram.utils import get_filename_map

logger = getLogger(__name__)


__all__ = [
    "download",
]


def _map_to_ids(lst: Sequence[Union[str, UUID]]) -> List[UUID]:
    return [UUID(item, version=4) if isinstance(item, str) else item for item in lst]


def _file_desitations(
    files: Sequence[File], *, dest: Path, allow_nested: bool = False
) -> Dict[Path, File]:
    if (
        len(set([(file.project_id, file.mission_id) for file in files])) > 1
        and not allow_nested
    ):
        raise ValueError("files from multiple missions were selected")
    elif not allow_nested:
        return {dest / file.name: file for file in files}
    else:
        return {
            dest / file.project_name / file.mission_name / file.name: file
            for file in files
        }


def _file_spec_from_args(
    file_ids: Optional[Sequence[Union[UUID, str]]] = None,
    file_patterns: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[Union[UUID, str]]] = None,
    mission_patterns: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[Union[UUID, str]]] = None,
    project_patterns: Optional[Sequence[str]] = None,
) -> FileSpec:
    mission_spec = _mission_spec_from_args(
        mission_ids=mission_ids,
        mission_patterns=mission_patterns,
        project_ids=project_ids,
        project_patterns=project_patterns,
    )

    file_spec = FileSpec(
        ids=_map_to_ids(file_ids) if file_ids else [],
        patterns=list(file_patterns) if file_patterns else [],
        mission_spec=mission_spec,
    )
    return file_spec


def _mission_spec_from_args(
    mission_ids: Optional[Sequence[Union[str, UUID]]] = None,
    mission_patterns: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    project_patterns: Optional[Sequence[str]] = None,
) -> MissionSpec:
    project_spec = _project_spec_from_args(project_ids, project_patterns)
    mission_spec = MissionSpec(
        ids=_map_to_ids(mission_ids) if mission_ids else [],
        patterns=list(mission_patterns) if mission_patterns else [],
        project_spec=project_spec,
    )
    return mission_spec


def _project_spec_from_args(
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    project_patterns: Optional[Sequence[str]] = None,
) -> ProjectSpec:
    project_spec = ProjectSpec(
        ids=_map_to_ids(project_ids) if project_ids else [],
        patterns=list(project_patterns) if project_patterns else [],
    )
    return project_spec


@overload
def download(
    *file: File,
    dest: Optional[Path],
    overwrite: bool = False,
    verbose: bool = False,
    allow_nested: bool = False,
) -> None: ...


@overload
def download(
    *,
    files: Sequence[File],
    dest: Optional[Path] = None,
    overwrite: bool = False,
    verbose: bool = False,
    allow_nested: bool = False,
) -> None: ...


def download(
    *file: File,
    files: Optional[Sequence[File]] = None,
    spec: Optional[FileSpec] = None,
    ids: Optional[Sequence[Union[str, UUID]]] = None,
    patterns: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[Union[str, UUID]]] = None,
    mission_patterns: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    allow_nested: bool = False,
    overwrite: bool = False,
    verbose: bool = False,
    dest: Optional[Path] = None,
) -> None:
    client = AuthenticatedClient()

    # TODO: check correct usage of args

    if spec is not None and any([ids, patterns, mission_ids, mission_patterns]):
        raise ValueError(
            "cannot specify both a file spec and file ids, patterns, mission ids or mission patterns"
        )
    if file is not None:
        files = [file]

    if spec is None:
        spec = _file_spec_from_args(
            file_ids=ids,
            file_patterns=patterns,
            mission_ids=mission_ids,
            mission_patterns=mission_patterns,
            project_ids=project_ids,
        )

    if files is None:
        files = get_files(client, spec)

    if verbose:
        Console().print(files_to_table(files, title="downloading files..."))

    paths = _file_desitations(files, dest=dest, allow_nested=allow_nested)
    logger.info(f"downloading {len(paths)} file(s) to {dest}")
    _download_files(
        client, paths, verbose=get_shared_state().verbose, overwrite=overwrite
    )


def create_project(name: str, *, verbose: bool = False) -> Project:
    raise NotImplementedError


def create_mission(
    name: str,
    *,
    project_id: Optional[UUID] = None,
    project_name: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
    verbose: bool = False,
    create_project: bool = False,
) -> Mission:
    raise NotImplementedError


_create_mission = create_mission
_create_project = create_project


def upload(
    files: List[Path],
    *,
    spec: Optional[MissionSpec] = None,
    mission_id: Optional[Union[str, UUID]] = None,
    mission_name: Optional[str] = None,
    project_id: Optional[Union[str, UUID]] = None,
    project_name: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
    verbose: bool = False,
    fix_filenames: bool = False,
    create_mission: bool = False,
    create_project: bool = False,
) -> None:
    if isinstance(mission_id, str):
        mission_id = UUID(mission_id, version=4)
    if isinstance(project_id, str):
        project_id = UUID(project_id, version=4)

    if spec is not None and any([mission_id, mission_name, project_id, project_name]):
        raise TypeError(
            "cannot specify both a mission spec and mission id, mission name, project id or project name"
        )

    if spec is None:
        spec = _mission_spec_from_args(
            mission_ids=[mission_id] if mission_id else None,
            mission_patterns=[mission_name] if mission_name else None,
            project_ids=[project_id] if project_id else None,
            project_patterns=[project_name] if project_name else None,
        )

    client = AuthenticatedClient()

    # create project if it does not exist
    try:
        _ = get_project(client, spec.project_spec)
    except ProjectNotFound:
        if not create_project:
            raise
        check_project_spec_is_creatable(spec.project_spec)
        _ = _create_project(spec.project_spec.patterns[0])

    # get or create mission
    try:
        mission = get_mission(client, spec)
    except MissionNotFound:
        if not create_mission:
            raise
        check_mission_spec_is_creatable(spec)
        mission = _create_mission(spec.patterns[0], project_id=project_id)

    files_map = get_filename_map(files)

    if not fix_filenames:
        for name, path in files_map.items():
            if name != path.name:
                raise ValueError(
                    f"invalid filename format {path.name}, use `--fix-filenames`"
                )

    upload_files(client, files_map, mission.id, n_workers=2, verbose=verbose)


def list_project_by_spec(spec: ProjectSpec) -> List[Project]: ...


def list_mission_by_spec(spec: MissionSpec) -> List[Mission]: ...


def list_file_by_spec(spec: FileSpec) -> List[File]: ...


@overload
def list_by_spec(spec: FileSpec) -> List[File]: ...


@overload
def list_by_spec(spec: MissionSpec) -> List[Mission]: ...


@overload
def list_by_spec(spec: ProjectSpec) -> List[Project]: ...


def list_by_spec(
    spec: Union[FileSpec, MissionSpec, ProjectSpec]
) -> Union[List[File], List[Mission], List[Project]]:
    if isinstance(spec, FileSpec):
        return list_file_by_spec(spec)
    elif isinstance(spec, MissionSpec):
        return list_mission_by_spec(spec)
    elif isinstance(spec, ProjectSpec):
        return list_project_by_spec(spec)


def list_files(
    *,
    spec: Optional[FileSpec] = None,
    file_ids: Optional[Sequence[Union[str, UUID]]] = None,
    file_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[Union[str, UUID]]] = None,
    mission_name: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[File]: ...


def list_missions(
    *,
    spec: Optional[MissionSpec] = None,
    mission_ids: Optional[Sequence[Union[str, UUID]]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Mission]: ...


def list_projects(
    *,
    spec: Optional[ProjectSpec] = None,
    project_ids: Optional[Sequence[Union[str, UUID]]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Project]: ...


def delete_files(
    file_ids: Sequence[Union[str, UUID]], mission_id: Union[str, UUID]
) -> None:
    if not file_ids:
        return

    if isinstance(mission_id, str):
        mission_id = UUID(mission_id, version=4)

    file_ids = [
        UUID(file_id, version=4) if isinstance(file_id, str) else file_id
        for file_id in file_ids
    ]

    client = AuthenticatedClient()
    _delete_files(client, file_ids, mission_id)


def delete_file(file_id: Union[str, UUID], mission_id: Union[str, UUID]) -> None:
    return delete_files([file_id], mission_id)


def delete_mission(mission_id: Union[str, UUID]) -> None:
    if isinstance(mission_id, str):
        mission_id = UUID(mission_id, version=4)

    client = AuthenticatedClient()
    files = get_files(client, FileSpec(mission_spec=MissionSpec(ids=[mission_id])))

    delete_files([file.id for file in files], mission_id)
    delete_mission(mission_id)


def delete_project(project_id: UUID) -> None:
    spec = MissionSpec(project_spec=ProjectSpec(ids=[project_id]))

    client = AuthenticatedClient()
    missions = get_missions(client, spec)

    for mission in missions:
        delete_mission(mission.id)
    _delete_project(client, project_id)


download
