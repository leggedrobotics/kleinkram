"""\
this file contains wrappers around core functionality

these functions are meant to be exposed to the user, they
accept a more diverse set of arguments and handle the
conversion to the internal representation
"""

from __future__ import annotations

from pathlib import Path
from typing import Collection, Any
from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Sequence
from typing import overload

import kleinkram.api.routes
import kleinkram.core
import kleinkram.utils
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.errors import FileNameNotSupported
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.types import IdLike
from kleinkram.types import PathLike
from kleinkram.utils import parse_path_like
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import singleton_list


def _args_to_project_query(
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> ProjectQuery:

    # verify types of passed arguments
    _verify_string_sequence("project_names", project_names)
    _verify_sequence("project_ids", project_ids)

    return ProjectQuery(
        ids=[parse_uuid_like(_id) for _id in project_ids or []],
        patterns=list(project_names or []),
    )


def _args_to_mission_query(
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> MissionQuery:

    # verify types of passed arguments
    _verify_string_sequence("mission_names", mission_names)
    _verify_sequence("mission_ids", mission_ids)
    _verify_string_sequence("project_names", project_names)
    _verify_sequence("project_ids", project_ids)

    return MissionQuery(
        ids=[parse_uuid_like(_id) for _id in mission_ids or []],
        patterns=list(mission_names or []),
        project_query=_args_to_project_query(
            project_names=project_names, project_ids=project_ids
        ),
    )


def _verify_sequence(arg_name: str, arg_value: Optional[Sequence[Any]]) -> None:
    """Verifies that an argument is either None, or a sequence."""
    if arg_value is not None:
        if not isinstance(arg_value, Sequence):
            raise TypeError(f"{arg_name} must be a Sequence, None, or empty array.")


def _verify_string_sequence(arg_name: str, arg_value: Optional[Sequence[Any]]) -> None:
    """Verifies that an argument is either None, an empty sequence, or a sequence of strings."""
    if arg_value is not None:
        if not isinstance(arg_value, Sequence):
            raise TypeError(f"{arg_name} must be a Sequence, None, or empty array.")
        if isinstance(arg_value, str):
            raise TypeError(
                f"{arg_name} cannot be a string, but a sequence of strings."
            )
        for item in arg_value:
            if not isinstance(item, str):
                raise TypeError(f"{arg_name} must contain strings only.")


def _args_to_file_query(
    file_names: Optional[Sequence[str]] = None,
    file_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    mission_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
) -> FileQuery:

    # verify types of passed arguments
    _verify_string_sequence("file_names", file_names)
    _verify_sequence("file_ids", file_ids)
    _verify_string_sequence("mission_names", mission_names)
    _verify_sequence("mission_ids", mission_ids)
    _verify_string_sequence("project_names", project_names)
    _verify_sequence("project_ids", project_ids)

    return FileQuery(
        ids=[parse_uuid_like(_id) for _id in file_ids or []],
        patterns=list(file_names or []),
        mission_query=_args_to_mission_query(
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
    verbose: bool = False,
) -> None:
    query = _args_to_file_query(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    kleinkram.core.download(
        client=client,
        query=query,
        base_dir=parse_path_like(dest),
        nested=nested,
        overwrite=overwrite,
        verbose=verbose,
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
    query = _args_to_file_query(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(kleinkram.api.routes.get_files(client, query))


def list_missions(
    *,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Mission]:
    query = _args_to_mission_query(
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(kleinkram.api.routes.get_missions(client, query))


def list_projects(
    *,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
) -> List[Project]:
    query = _args_to_project_query(
        project_names=project_names,
        project_ids=project_ids,
    )
    client = AuthenticatedClient()
    return list(kleinkram.api.routes.get_projects(client, query))


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
    verbose: bool = False,
) -> None: ...


@overload
def upload(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
    create: Literal[False] = False,
    fix_filenames: bool = False,
    verbose: bool = False,
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
    verbose: bool = False,
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
    verbose: bool = False,
) -> None:
    parsed_file_paths = [parse_path_like(f) for f in files]
    if not fix_filenames:
        for file in parsed_file_paths:
            if not kleinkram.utils.check_filename_is_sanatized(file.stem):
                print(file.name)
                raise FileNameNotSupported(
                    f"only `{''.join(kleinkram.utils.INTERNAL_ALLOWED_CHARS)}` are "
                    f"allowed in filenames and at most 50 chars: {file}"
                )

    query = _args_to_mission_query(
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )
    client = AuthenticatedClient()
    kleinkram.core.upload(
        client=client,
        query=query,
        file_paths=parsed_file_paths,
        create=create,
        metadata=metadata,
        ignore_missing_metadata=ignore_missing_metadata,
        verbose=verbose,
    )


@overload
def verify(
    *,
    mission_name: str,
    project_name: str,
    files: Sequence[PathLike],
    verbose: bool = False,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]: ...


@overload
def verify(
    *,
    mission_name: str,
    project_id: IdLike,
    files: Sequence[PathLike],
    verbose: bool = False,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]: ...


@overload
def verify(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
    verbose: bool = False,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]: ...


def verify(
    *,
    mission_name: Optional[str] = None,
    mission_id: Optional[IdLike] = None,
    project_name: Optional[str] = None,
    project_id: Optional[IdLike] = None,
    files: Sequence[PathLike],
    skip_hash: bool = False,
    verbose: bool = False,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]:
    query = _args_to_mission_query(
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )

    _verify_string_sequence("files", files)

    return kleinkram.core.verify(
        client=AuthenticatedClient(),
        query=query,
        file_paths=[parse_path_like(f) for f in files],
        skip_hash=skip_hash,
        verbose=verbose,
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


def create_project(project_name: str, description: str) -> None:
    kleinkram.api.routes._create_project(
        AuthenticatedClient(), project_name, description
    )


def update_file(file_id: IdLike) -> None:
    kleinkram.core.update_file(
        client=AuthenticatedClient(), file_id=parse_uuid_like(file_id)
    )


def update_mission(mission_id: IdLike, metadata: Dict[str, str]) -> None:
    kleinkram.core.update_mission(
        client=AuthenticatedClient(),
        mission_id=parse_uuid_like(mission_id),
        metadata=metadata,
    )


def update_project(project_id: IdLike, description: Optional[str] = None) -> None:
    kleinkram.core.update_project(
        client=AuthenticatedClient(),
        project_id=parse_uuid_like(project_id),
        description=description,
    )


def delete_files(file_ids: Collection[IdLike]) -> None:
    """\
    delete multiple files by their ids
    """
    kleinkram.core.delete_files(
        client=AuthenticatedClient(),
        file_ids=[parse_uuid_like(_id) for _id in file_ids],
    )


def delete_file(file_id: IdLike) -> None:
    """\
    delete a single file by id
    """
    file = kleinkram.api.routes.get_file(
        AuthenticatedClient(), FileQuery(ids=[parse_uuid_like(file_id)])
    )
    kleinkram.api.routes._delete_files(
        AuthenticatedClient(), file_ids=[file.id], mission_id=file.mission_id
    )


def delete_mission(mission_id: IdLike) -> None:
    kleinkram.core.delete_mission(
        client=AuthenticatedClient(), mission_id=parse_uuid_like(mission_id)
    )


def delete_project(project_id: IdLike) -> None:
    kleinkram.core.delete_project(
        client=AuthenticatedClient(), project_id=parse_uuid_like(project_id)
    )


def get_file(file_id: IdLike) -> File:
    """\
    get a file by its id
    """
    return kleinkram.api.routes.get_file(
        AuthenticatedClient(), FileQuery(ids=[parse_uuid_like(file_id)])
    )


def get_mission(mission_id: IdLike) -> Mission:
    """\
    get a mission by its id
    """
    return kleinkram.api.routes.get_mission(
        AuthenticatedClient(), MissionQuery(ids=[parse_uuid_like(mission_id)])
    )


def get_project(project_id: IdLike) -> Project:
    """\
    get a project by its id
    """
    return kleinkram.api.routes.get_project(
        AuthenticatedClient(), ProjectQuery(ids=[parse_uuid_like(project_id)])
    )
