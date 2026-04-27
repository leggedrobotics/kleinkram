"""\
this file contains wrappers around core functionality

these functions are meant to be exposed to the user, they
accept a more diverse set of arguments and handle the
conversion to the internal representation
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from typing import Collection
from typing import Dict
from typing import List
from typing import Literal
from typing import Optional
from typing import Sequence
from typing import Union
from typing import overload

import kleinkram.api.routes
import kleinkram.core
import kleinkram.utils
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.errors import FileNameNotSupported
from kleinkram.models import ActionTemplate
from kleinkram.models import Execution
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
        project_query=_args_to_project_query(project_names=project_names, project_ids=project_ids),
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
            raise TypeError(f"{arg_name} cannot be a string, but a sequence of strings.")
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
    allow_corrupt_files: bool = False,
    verbose: bool = False,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    query = _args_to_file_query(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = client or AuthenticatedClient()
    kleinkram.core.download(
        client=client,
        query=query,
        base_dir=parse_path_like(dest),
        nested=nested,
        overwrite=overwrite,
        verbose=verbose,
        allow_corrupt_files=allow_corrupt_files,
    )


def download_artifact(
    execution_id: IdLike,
    output: Optional[PathLike] = None,
    extract: bool = False,
    verbose: bool = False,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> str:
    """
    Download the artifacts (.tar.gz) for a finished execution.

    Args:
        execution_id: The ID of the execution to download artifacts for.
        output: Path or filename to save the artifacts to.
        extract: Automatically extract the archive after downloading.
        verbose: Print progress and extraction info.

    Returns:
        The path where the artifact was saved (or extracted).
    """
    client = client or AuthenticatedClient()
    return kleinkram.core.download_artifact(
        client=client,
        execution_id=str(parse_uuid_like(execution_id)),
        output=str(parse_path_like(output)) if output else None,
        extract=extract,
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
    client: Optional[AuthenticatedClient] = None,
) -> List[File]:
    query = _args_to_file_query(
        file_names=file_names,
        file_ids=file_ids,
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = client or AuthenticatedClient()
    return list(kleinkram.api.routes.get_files(client, query))


def list_missions(
    *,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_names: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    client: Optional[AuthenticatedClient] = None,
) -> List[Mission]:
    query = _args_to_mission_query(
        mission_names=mission_names,
        mission_ids=mission_ids,
        project_names=project_names,
        project_ids=project_ids,
    )
    client = client or AuthenticatedClient()
    return list(kleinkram.api.routes.get_missions(client, query))


def list_projects(
    *,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_names: Optional[Sequence[str]] = None,
    client: Optional[AuthenticatedClient] = None,
) -> List[Project]:
    query = _args_to_project_query(
        project_names=project_names,
        project_ids=project_ids,
    )
    client = client or AuthenticatedClient()
    return list(kleinkram.api.routes.get_projects(client, query))


def list_templates(*, latest_only: bool = True, client: Optional[AuthenticatedClient] = None) -> List[ActionTemplate]:
    client = client or AuthenticatedClient()
    return kleinkram.core.list_templates(client, latest_only=latest_only)


def list_executions(
    *,
    mission_ids: Optional[Sequence[IdLike]] = None,
    mission_patterns: Optional[Sequence[str]] = None,
    project_ids: Optional[Sequence[IdLike]] = None,
    project_patterns: Optional[Sequence[str]] = None,
    client: Optional[AuthenticatedClient] = None,
) -> List[Execution]:

    # build ExecutionQuery from arguments
    query = ExecutionQuery(
        mission_ids=[parse_uuid_like(_id) for _id in mission_ids or []],
        mission_patterns=list(mission_patterns or []),
        project_ids=[parse_uuid_like(_id) for _id in project_ids or []],
        project_patterns=list(project_patterns or []),
    )

    client = client or AuthenticatedClient()
    return list(kleinkram.api.routes.get_executions(client, query=query))


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
    client: Optional[AuthenticatedClient] = None,
) -> None: ...


@overload
def upload(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
    create: Literal[False] = False,
    fix_filenames: bool = False,
    verbose: bool = False,
    client: Optional[AuthenticatedClient] = None,
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
    client: Optional[AuthenticatedClient] = None,
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
    client: Optional[AuthenticatedClient] = None,
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
    client = client or AuthenticatedClient()
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
    client: Optional[AuthenticatedClient] = None,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]: ...


@overload
def verify(
    *,
    mission_name: str,
    project_id: IdLike,
    files: Sequence[PathLike],
    verbose: bool = False,
    client: Optional[AuthenticatedClient] = None,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]: ...


@overload
def verify(
    *,
    mission_id: IdLike,
    files: Sequence[PathLike],
    verbose: bool = False,
    client: Optional[AuthenticatedClient] = None,
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
    client: Optional[AuthenticatedClient] = None,
) -> Dict[Path, kleinkram.core.FileVerificationStatus]:
    query = _args_to_mission_query(
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )

    _verify_string_sequence("files", files)

    client = client or AuthenticatedClient()
    return kleinkram.core.verify(
        client=client,
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
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.create_mission(
        client,
        parse_uuid_like(project_id),
        mission_name,
        metadata=metadata,
        ignore_missing_tags=ignore_missing_metadata,
    )


def get_template_revisions(template_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> List[ActionTemplate]:
    """\
    get history/revisions for a specific template by its id
    """
    client = client or AuthenticatedClient()
    return list(kleinkram.api.routes.get_template_revisions(client, str(parse_uuid_like(template_id))))


def create_template_version(
    template_id: IdLike,
    *,
    description: Optional[str] = None,
    docker_image: Optional[str] = None,
    cpu_cores: Optional[int] = None,
    cpu_memory_gb: Optional[int] = None,
    gpu_memory_gb: Optional[int] = None,
    max_runtime_minutes: Optional[int] = None,
    access_rights: Optional[int] = None,
    command: Optional[str] = None,
    entrypoint: Optional[str] = None,
    client: Optional[AuthenticatedClient] = None,
) -> IdLike:
    client = client or AuthenticatedClient()
    return kleinkram.core.create_template_version(
        client,
        template_id=parse_uuid_like(template_id),
        description=description,
        docker_image=docker_image,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        gpu_memory_gb=gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes,
        access_rights=access_rights,
        command=command,
        entrypoint=entrypoint,
    )


def create_template(
    name: str,
    description: str,
    docker_image: str,
    cpu_cores: int,
    cpu_memory_gb: int,
    gpu_memory_gb: int,
    max_runtime_minutes: int,
    access_rights: int = 0,
    command: Optional[str] = None,
    entrypoint: Optional[str] = None,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> IdLike:
    client = client or AuthenticatedClient()
    return kleinkram.core.create_template(
        client,
        name=name,
        description=description,
        docker_image=docker_image,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        gpu_memory_gb=gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes,
        access_rights=access_rights,
        command=command,
        entrypoint=entrypoint,
    )


def create_project(
    project_name: str,
    description: str,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.create_project(client, project_name, description)


def update_file(
    file_id: IdLike,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.update_file(client=client, file_id=parse_uuid_like(file_id))


def update_mission(
    mission_id: IdLike,
    metadata: Dict[str, str],
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.update_mission(
        client=client,
        mission_id=parse_uuid_like(mission_id),
        metadata=metadata,
    )


def update_project(
    project_id: IdLike,
    description: Optional[str] = None,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.update_project(
        client=client,
        project_id=parse_uuid_like(project_id),
        description=description,
    )


def delete_files(
    file_ids: Collection[IdLike],
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    """\
    delete multiple files by their ids
    """
    client = client or AuthenticatedClient()
    kleinkram.core.delete_files(
        client=client,
        file_ids=[parse_uuid_like(_id) for _id in file_ids],
    )


def delete_file(
    file_id: IdLike,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    """\
    delete a single file by id
    """
    client = client or AuthenticatedClient()
    file = kleinkram.api.routes.get_file(client, FileQuery(ids=[parse_uuid_like(file_id)]))
    kleinkram.api.routes._delete_files(client, file_ids=[file.id], mission_id=file.mission_id)


def delete_template(
    template_id: IdLike,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.delete_template(client=client, template_id=parse_uuid_like(template_id))


def delete_mission(
    mission_id: IdLike,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.delete_mission(client=client, mission_id=parse_uuid_like(mission_id))


def delete_project(
    project_id: IdLike,
    *,
    client: Optional[AuthenticatedClient] = None,
) -> None:
    client = client or AuthenticatedClient()
    kleinkram.core.delete_project(client=client, project_id=parse_uuid_like(project_id))


def get_file(file_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> File:
    """\
    get a file by its id
    """
    client = client or AuthenticatedClient()
    return kleinkram.api.routes.get_file(client, FileQuery(ids=[parse_uuid_like(file_id)]))


def get_template(template_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> ActionTemplate:
    """\
    get detailed information for a specific template by its id
    """
    client = client or AuthenticatedClient()
    return kleinkram.api.routes.get_template(client, str(parse_uuid_like(template_id)))


def get_execution(execution_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> Execution:
    """\
    get detailed information and logs for a specific execution by its id
    """
    client = client or AuthenticatedClient()
    return kleinkram.api.routes.get_execution(client, str(parse_uuid_like(execution_id)))


def get_mission(mission_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> Mission:
    """\
    get a mission by its id
    """
    client = client or AuthenticatedClient()
    return kleinkram.api.routes.get_mission(client, MissionQuery(ids=[parse_uuid_like(mission_id)]))


def get_project(project_id: IdLike, *, client: Optional[AuthenticatedClient] = None) -> Project:
    """\
    get a project by its id
    """
    client = client or AuthenticatedClient()
    return kleinkram.api.routes.get_project(client, ProjectQuery(ids=[parse_uuid_like(project_id)]))


@overload
def launch_execution(
    template: Union[str, IdLike],
    *,
    mission_name: str,
    project_name: str,
    client: Optional[AuthenticatedClient] = None,
) -> str: ...


@overload
def launch_execution(
    template: Union[str, IdLike],
    *,
    mission_id: IdLike,
    client: Optional[AuthenticatedClient] = None,
) -> str: ...


@overload
def launch_execution(
    template: Union[str, IdLike],
    *,
    mission_name: str,
    project_id: IdLike,
    client: Optional[AuthenticatedClient] = None,
) -> str: ...


def launch_execution(
    template: Union[str, IdLike],
    *,
    mission_name: Optional[str] = None,
    mission_id: Optional[IdLike] = None,
    project_name: Optional[str] = None,
    project_id: Optional[IdLike] = None,
    client: Optional[AuthenticatedClient] = None,
) -> str:
    """
    Launch a new execution from an action template.
    """
    query = _args_to_mission_query(
        mission_names=singleton_list(mission_name),
        mission_ids=singleton_list(mission_id),
        project_names=singleton_list(project_name),
        project_ids=singleton_list(project_id),
    )

    client = client or AuthenticatedClient()
    return kleinkram.core.launch_execution(
        client=client,
        mission_query=query,
        template=template,
    )
