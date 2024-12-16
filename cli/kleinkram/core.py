"""
this file contains the main functionality of kleinkram cli

we expose this functionality as a python package.
the cli commands use the same functions as the python package

TODO:
- parsing args, when should args be singular / plural?
"""

from __future__ import annotations

from pathlib import Path
from typing import Collection
from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Sequence
from typing import TypeVar
from typing import overload
from uuid import UUID

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import FileSpec
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.api.resources import check_mission_spec_is_creatable
from kleinkram.api.resources import get_files
from kleinkram.api.resources import get_missions
from kleinkram.api.resources import get_project
from kleinkram.api.resources import get_projects
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.types import IdLike
from kleinkram.types import PathLike

T = TypeVar("T")


def _singleton_list(x: Optional[T]) -> List[T]:
    return [] if x is None else [x]


def _parse_uuid_like(s: IdLike) -> UUID:
    return UUID(str(s))


def _parse_path_like(s: PathLike) -> Path:
    return Path(s)


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


def _args_to_project_spec(
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> ProjectSpec:
    return ProjectSpec(
        ids=[_parse_uuid_like(_id) for _id in project_ids or []],
        patterns=list(project_names or []),
    )


def _args_to_mission_spec(
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> MissionSpec:
    return MissionSpec(
        ids=[_parse_uuid_like(_id) for _id in mission_ids or []],
        patterns=list(mission_names or []),
        project_spec=_args_to_project_spec(
            project_names=project_names, project_ids=project_ids
        ),
    )


def _args_to_file_spec(
    file_names: Optional[Sequence[str]] = None,
    file_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> FileSpec:
    return FileSpec(
        ids=[_parse_uuid_like(_id) for _id in file_ids or []],
        patterns=list(file_names or []),
        mission_spec=_args_to_mission_spec(
            mission_names=mission_names,
            mission_ids=mission_ids,
            project_names=project_names,
            project_ids=project_ids,
        ),
    )


def _download(
    *,
    client: AuthenticatedClient,
    spec: FileSpec,
    dest: Path,
    nested: bool = False,
    overwrite: bool = False,
) -> None:
    client = AuthenticatedClient()
    files = list(get_files(client, spec))
    path_map = _file_desitations(files, dest=dest, allow_nested=nested)

    for path, file in path_map.items():
        ...

    raise NotImplementedError


def _upload(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    files: Sequence[Path],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None:
    if metadata is None:
        metadata = {}

    if create:
        name = check_mission_spec_is_creatable(spec)
        project = get_project(client, spec.project_spec)
        _create_mission(client, name, project.id)

    if fix_filenames:
        ...

    raise NotImplementedError


def _verify(
    *,
    client: AuthenticatedClient,
    spec: MissionSpec,
    files: Sequence[Path],
    skip_hash: bool = False,
    fix_filenames: bool = False,
) -> None:

    if fix_filenames:
        ...

    raise NotImplementedError


# single resource crud


def _create_mission(
    client: AuthenticatedClient, mission_name: str, project_id: UUID
) -> None:
    raise NotImplementedError


def _create_project(client: AuthenticatedClient, project_name: str) -> None:
    raise NotImplementedError


def _delete_files(client: AuthenticatedClient, file_ids: Collection[UUID]) -> None:
    raise NotImplementedError


def _delete_mission(client: AuthenticatedClient, mission_id: UUID) -> None:
    raise NotImplementedError


def _delete_project(client: AuthenticatedClient, project_id: UUID) -> None:
    raise NotImplementedError


def _update_project(
    client: AuthenticatedClient, project_id: UUID, description: Optional[str] = None
) -> None:
    raise NotImplementedError


def _update_mission(
    *, client: AuthenticatedClient, mission_id: UUID, metadata: Dict[str, str]
) -> None:
    raise NotImplementedError


##################################################
# everything below is part of the public api
# TODO: move different parts into separate files
##################################################


def download(
    *,
    file_ids: Optional[Sequence[IdLike]] = None,
    file_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    dest: PathLike,
    nested: bool = False,
    overwrite: bool = False,
) -> None:
    spec = _args_to_file_spec(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    _download(
        client=client,
        spec=spec,
        dest=_parse_path_like(dest),
        nested=nested,
        overwrite=overwrite,
    )


def list_files(
    *,
    file_ids: Optional[Sequence[IdLike]] = None,
    file_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[File]:
    spec = _args_to_file_spec(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(get_files(client, spec))


def list_missions(
    *,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Mission]:
    spec = _args_to_mission_spec(
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(get_missions(client, spec))


def list_projects(
    *,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Project]:
    spec = _args_to_project_spec(
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(get_projects(client, spec))


@overload
def upload(
    *,
    mission_name: str,
    project_name: str,
    files: Sequence[PathLike],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None: ...


@overload
def upload(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
    create: Literal[False] = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None: ...


@overload
def upload(
    *,
    mission_name: str,
    project_id: IdLike,
    files: Sequence[PathLike],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None: ...


def upload(
    *,
    mission_name: Optional[str] = None,
    mission_id: Optional[IdLike] = None,
    project_name: Optional[str] = None,
    project_id: Optional[IdLike] = None,
    files: Sequence[PathLike],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None:
    spec = _args_to_mission_spec(
        mission_names=_singleton_list(mission_name),
        mission_ids=_singleton_list(mission_id),
        project_names=_singleton_list(project_name),
        project_ids=_singleton_list(project_id),
    )
    client = AuthenticatedClient()
    _upload(
        client=client,
        spec=spec,
        files=[_parse_path_like(f) for f in files],
        create=create,
        ignore_missing_metadata=ignore_missing_metadata,
        fix_filenames=fix_filenames,
        metadata=metadata,
    )


@overload
def verify(
    *,
    mission_name: str,
    project_name: str,
    files: Sequence[PathLike],
) -> None: ...


@overload
def verify(
    *,
    mission_name: str,
    project_id: IdLike,
    files: Sequence[PathLike],
) -> None: ...


@overload
def verify(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
) -> None: ...


def verify(
    *,
    mission_name: Optional[str] = None,
    mission_id: Optional[IdLike] = None,
    project_name: Optional[str] = None,
    project_id: Optional[IdLike] = None,
    files: Sequence[PathLike],
) -> None:
    spec = _args_to_mission_spec(
        mission_names=_singleton_list(mission_name),
        mission_ids=_singleton_list(mission_id),
        project_names=_singleton_list(project_name),
        project_ids=_singleton_list(project_id),
    )
    _verify(
        client=AuthenticatedClient(),
        spec=spec,
        files=[_parse_path_like(f) for f in files],
    )


# update delete


def update_file(file_id: IdLike) -> None:
    """TODO: what should this do?"""
    _ = file_id
    raise NotImplementedError


def update_mission(mission_id: IdLike, metadata: Dict[str, str]) -> None:
    _update_mission(
        client=AuthenticatedClient(),
        mission_id=_parse_uuid_like(mission_id),
        metadata=metadata,
    )


def update_project(project_id: IdLike, description: Optional[str] = None) -> None:
    _update_project(
        client=AuthenticatedClient(),
        project_id=_parse_uuid_like(project_id),
        description=description,
    )


def delete_file(file_id: IdLike) -> None:
    raise NotImplementedError


def delete_mission(mission_id: IdLike) -> None:
    raise NotImplementedError


def delete_project(project_id: IdLike) -> None:
    raise NotImplementedError


# create mission, project


def create_mission(
    mission_name: str, project_id: IdLike, metadata: Dict[str, str]
) -> None:
    raise NotImplementedError


def create_project(project_name: str) -> None:
    raise NotImplementedError
