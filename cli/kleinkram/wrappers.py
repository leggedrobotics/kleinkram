"""\
this file contains wrappers around core funcitons in core

these functions are meant to be exposed to the user
"""

from __future__ import annotations

from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Sequence
from typing import overload

import kleinkram.api.resources
import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.resources import FileSpec
from kleinkram.api.resources import MissionSpec
from kleinkram.api.resources import ProjectSpec
from kleinkram.core import _delete_mission
from kleinkram.core import _delete_project
from kleinkram.core import _download
from kleinkram.core import _update_file
from kleinkram.core import _update_mission
from kleinkram.core import _update_project
from kleinkram.core import _upload
from kleinkram.core import _verify
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.types import IdLike
from kleinkram.types import PathLike
from kleinkram.utils import parse_path_like
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import singleton_list


def _args_to_project_spec(
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> ProjectSpec:
    return ProjectSpec(
        ids=[parse_uuid_like(_id) for _id in project_ids or []],
        patterns=list(project_names or []),
    )


def _args_to_mission_spec(
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> MissionSpec:
    return MissionSpec(
        ids=[parse_uuid_like(_id) for _id in mission_ids or []],
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
        ids=[parse_uuid_like(_id) for _id in file_ids or []],
        patterns=list(file_names or []),
        mission_spec=_args_to_mission_spec(
            mission_names=mission_names,
            mission_ids=mission_ids,
            project_names=project_names,
            project_ids=project_ids,
        ),
    )


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
        dest=parse_path_like(dest),
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
    return list(kleinkram.api.resources.get_files(client, spec))


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
    return list(kleinkram.api.resources.get_missions(client, spec))


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
    return list(kleinkram.api.resources.get_projects(client, spec))


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
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )
    client = AuthenticatedClient()
    _upload(
        client=client,
        spec=spec,
        files=[parse_path_like(f) for f in files],
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
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )
    _verify(
        client=AuthenticatedClient(),
        spec=spec,
        files=[parse_path_like(f) for f in files],
    )


def create_mission(
    mission_name: str,
    project_id: IdLike,
    metadata: Dict[str, str],
    ignore_missing_metadata: bool = False,
) -> None:
    kleinkram.api.routes._create_mission(
        AuthenticatedClient(),
        parse_uuid_like(project_id),
        mission_name,
        metadata=metadata,
        ignore_missing_tags=ignore_missing_metadata,
    )


def create_project(project_name: str) -> None:
    kleinkram.api.routes._create_project(AuthenticatedClient(), project_name)


def update_file(file_id: IdLike) -> None:
    _update_file(client=AuthenticatedClient(), file_id=parse_uuid_like(file_id))


def update_mission(mission_id: IdLike, metadata: Dict[str, str]) -> None:
    _update_mission(
        client=AuthenticatedClient(),
        mission_id=parse_uuid_like(mission_id),
        metadata=metadata,
    )


def update_project(project_id: IdLike, description: Optional[str] = None) -> None:
    _update_project(
        client=AuthenticatedClient(),
        project_id=parse_uuid_like(project_id),
        description=description,
    )


def delete_file(file_id: IdLike) -> None:
    file = kleinkram.api.resources.get_file(
        AuthenticatedClient(), FileSpec(ids=[parse_uuid_like(file_id)])
    )
    kleinkram.api.routes._delete_files(
        AuthenticatedClient(), file_ids=[file.id], mission_id=file.mission_id
    )


def delete_mission(mission_id: IdLike) -> None:
    _delete_mission(AuthenticatedClient(), parse_uuid_like(mission_id))


def delete_project(project_id: IdLike) -> None:
    _delete_project(AuthenticatedClient(), parse_uuid_like(project_id))
