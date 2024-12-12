"""
this file contains the main functionality of kleinkram cli

we expose this functionality as a python package.
the cli commands use the same functions as the python package

TODO:
- parsing args, when should args be singular / plural?
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Sequence
from typing import TypeVar
from typing import overload
from uuid import UUID

from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.resources import FileSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.types import IdLike
from kleinkram.types import PathLike

T = TypeVar("T")


def _singleton_list(x: Optional[T]) -> List[T]:
    return [] if x is None else [x]


def _parse_uuid_like(s: IdLike) -> UUID:
    return UUID(str(s))


def _parse_path_like(s: PathLike) -> Path:
    return Path(s)


def _args_to_project_spec(
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    spec: Optional[ProjectSpec] = None,
) -> ProjectSpec:
    if (project_names or project_ids) and spec is not None:
        raise TypeError("`spec` and individual arguments are mutually exclusive")

    if spec is None:
        spec = ProjectSpec(
            ids=[_parse_uuid_like(_id) for _id in project_ids or []],
            patterns=list(project_names or []),
        )
    return spec


def _args_to_mission_spec(
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    spec: Optional[MissionSpec] = None,
) -> MissionSpec:

    if (
        any([mission_names, mission_ids, project_names, project_ids])
        and spec is not None
    ):
        raise TypeError("`spec` and individual arguments are mutually exclusive")

    if spec is None:
        spec = MissionSpec(
            ids=[_parse_uuid_like(_id) for _id in mission_ids or []],
            patterns=list(mission_names or []),
            project_spec=_args_to_project_spec(
                project_names=project_names, project_ids=project_ids
            ),
        )
    return spec


def _args_to_file_spec(
    file_names: Optional[Sequence[str]] = None,
    file_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    spec: Optional[FileSpec] = None,
) -> FileSpec:
    if (
        any(
            [
                file_names,
                file_ids,
                mission_names,
                mission_ids,
                project_names,
                project_ids,
            ]
        )
        and spec is not None
    ):
        raise TypeError("`spec` and individual arguments are mutually exclusive")

    if spec is None:
        spec = FileSpec(
            ids=[_parse_uuid_like(_id) for _id in file_ids or []],
            patterns=list(file_names or []),
            mission_spec=_args_to_mission_spec(
                mission_names=mission_names,
                mission_ids=mission_ids,
                project_names=project_names,
                project_ids=project_ids,
            ),
        )
    return spec


def _download(
    *, spec: FileSpec, dest: Path, nested: bool = False, overwrite: bool = False
) -> None:
    raise NotImplementedError


def _upload(
    *,
    spec: MissionSpec,
    files: Sequence[Path],
    create: bool = False,
    fix_filenames: bool = False,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_metadata: bool = False,
) -> None:
    if metadata is None:
        metadata = {}

    raise NotImplementedError


def _verify(
    *, spec: MissionSpec, files: Sequence[Path], skip_hash: bool = False
) -> None:
    raise NotImplementedError


def _list_files(spec: FileSpec) -> List[File]:
    raise NotImplementedError


def _list_missions(spec: MissionSpec) -> List[Mission]:
    raise NotImplementedError


def _list_projects(spec: ProjectSpec) -> List[Project]:
    raise NotImplementedError


def _create_project() -> None:
    raise NotImplementedError


def _delete_project() -> None:
    raise NotImplementedError


def _update_project() -> None:
    raise NotImplementedError


def _create_mission() -> None:
    raise NotImplementedError


def _delete_mission() -> None:
    raise NotImplementedError


def _update_mission(*, spec: MissionSpec, metadata: Dict[str, str]) -> None:
    raise NotImplementedError


##################################################
# everything below is part of the public api
# TODO: move different parts into separate files
##################################################


@overload
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
) -> None: ...


@overload
def download(
    spec: FileSpec,
    *,
    dest: PathLike,
    nested: bool = False,
    overwrite: bool = False,
) -> None:
    """\
    download files from kleinkram
    """


def download(
    spec: Optional[FileSpec] = None,
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
        spec=spec,
    )
    _download(
        spec=spec, dest=_parse_path_like(dest), nested=nested, overwrite=overwrite
    )


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
) -> None:
    """\
    """


@overload
def upload(
    spec: MissionSpec,
    *,
    files: Sequence[PathLike],
    create: bool = False,
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
    spec: Optional[MissionSpec] = None,
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
        spec=spec,
    )
    _upload(
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
    mission_id: IdLike,
    files: Sequence[PathLike],
) -> None: ...


@overload
def verify(
    spec: MissionSpec,
    *,
    files: Sequence[PathLike],
) -> None: ...


@overload
def verify(
    *,
    mission_name: str,
    project_id: IdLike,
    files: Sequence[PathLike],
) -> None: ...


def verify(
    spec: Optional[MissionSpec] = None,
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
        spec=spec,
    )
    _verify(spec=spec, files=[_parse_path_like(f) for f in files])


@overload
def update_mission(spec: MissionSpec, *, metadata: Dict[str, str]) -> None: ...


@overload
def update_mission(
    *, mission_name: str, project_name: str, metadata: Dict[str, str]
) -> None: ...


@overload
def update_mission(*, mission_id: IdLike, metadata: Dict[str, str]) -> None: ...


@overload
def update_mission(
    *, mission_name: str, project_id: IdLike, metadata: Dict[str, str]
) -> None: ...


def update_mission(
    spec: Optional[MissionSpec] = None,
    *,
    mission_name: Optional[str] = None,
    mission_id: Optional[IdLike] = None,
    project_name: Optional[str] = None,
    project_id: Optional[IdLike] = None,
    metadata: Dict[str, str],
) -> None:
    spec = _args_to_mission_spec(
        mission_names=_singleton_list(mission_name),
        mission_ids=_singleton_list(mission_id),
        project_names=_singleton_list(project_name),
        project_ids=_singleton_list(project_id),
        spec=spec,
    )
    _update_mission(spec=spec, metadata=metadata)


@overload
def list_files(
    *,
    file_ids: Optional[Sequence[IdLike]] = None,
    file_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[File]: ...


@overload
def list_files(
    spec: FileSpec,
) -> List[File]: ...


def list_files(
    spec: Optional[FileSpec] = None,
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
        spec=spec,
    )
    return _list_files(spec)


@overload
def list_missions(
    *,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Mission]: ...


@overload
def list_missions(
    spec: MissionSpec,
) -> List[Mission]: ...


def list_missions(
    spec: Optional[MissionSpec] = None,
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
        spec=spec,
    )
    return _list_missions(spec)


@overload
def list_projects(
    *,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Project]: ...


@overload
def list_projects(
    spec: ProjectSpec,
) -> List[Project]: ...


def list_projects(
    spec: Optional[ProjectSpec] = None,
    *,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Project]:
    spec = _args_to_project_spec(
        project_names=project_names,
        project_ids=project_ids,
        spec=spec,
    )
    return _list_projects(spec)
