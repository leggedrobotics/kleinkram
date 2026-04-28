from __future__ import annotations

import json
import tempfile
from enum import Enum
from pathlib import Path
from typing import Any
from typing import Dict
from typing import Generator
from typing import List
from typing import Optional
from typing import Sequence
from typing import Tuple
from uuid import UUID

import httpx

import kleinkram.errors
from kleinkram._version import __version__
from kleinkram.api.client import CLI_VERSION_HEADER
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.deser import ExecutionObject
from kleinkram.api.deser import FileObject
from kleinkram.api.deser import MissionObject
from kleinkram.api.deser import ProjectObject
from kleinkram.api.deser import _parse_action_template
from kleinkram.api.deser import _parse_execution
from kleinkram.api.deser import _parse_file
from kleinkram.api.deser import _parse_mission
from kleinkram.api.deser import _parse_project
from kleinkram.api.pagination import paginated_request
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.query import file_query_is_unique
from kleinkram.api.query import mission_query_is_unique
from kleinkram.api.query import project_query_is_unique
from kleinkram.config import get_config
from kleinkram.errors import AccessDenied
from kleinkram.errors import InvalidFileQuery
from kleinkram.errors import InvalidMissionMetadata
from kleinkram.errors import InvalidMissionQuery
from kleinkram.errors import InvalidProjectQuery
from kleinkram.errors import MissionExists
from kleinkram.errors import MissionNotFound
from kleinkram.errors import MissionValidationError
from kleinkram.errors import ProjectExists
from kleinkram.errors import ProjectNotFound
from kleinkram.errors import ProjectValidationError
from kleinkram.errors import TemplateExists
from kleinkram.errors import TemplateNotFound
from kleinkram.errors import TemplateValidationError
from kleinkram.models import ActionTemplate
from kleinkram.models import Execution
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import split_args

__all__ = [
    "_get_api_version",
    "_claim_admin",
    "_create_mission",
    "_create_project",
    "_update_mission",
    "_update_project",
    "_delete_files",
    "_delete_mission",
    "_delete_project",
    "get_files",
    "get_missions",
    "get_projects",
    "get_project",
    "get_mission",
    "get_file",
]


CLAIM_ADMIN = "/user/claimAdmin"
GET_STATUS = "/user/me"

UPDATE_PROJECT = "/projects"
UPDATE_MISSION = "/missions/tags"  # TODO: just metadata for now
CREATE_MISSION = "/missions/create"
CREATE_PROJECT = "/projects"


FILE_ENDPOINT = "/files"
MISSION_ENDPOINT = "/missions"
PROJECT_ENDPOINT = "/projects"

TAG_TYPE_BY_NAME = "/tag/filtered"

ACTION_ENDPOINT = "/action"


class Params(str, Enum):
    FILE_PATTERNS = "filePatterns"
    FILE_IDS = "fileUuids"
    MISSION_PATTERNS = "missionPatterns"
    MISSION_IDS = "missionUuids"
    PROJECT_PATTERNS = "projectPatterns"
    PROJECT_IDS = "projectUuids"


def _handle_list_params(params: Dict[str, Any]) -> Dict[str, Any]:
    """
    json dumps lists
    """
    new_params = {}
    for k, v in params.items():
        if not isinstance(v, list):
            new_params[k] = v
        else:
            new_params[k] = json.dumps(v)
    return new_params


def _project_query_to_params(
    project_query: ProjectQuery,
) -> Dict[str, List[str]]:
    params = {}
    if project_query.patterns:
        params[Params.PROJECT_PATTERNS.value] = project_query.patterns
    if project_query.ids:
        params[Params.PROJECT_IDS.value] = list(map(str, project_query.ids))
    return params


def _mission_query_to_params(mission_query: MissionQuery) -> Dict[str, List[str]]:
    params = _project_query_to_params(mission_query.project_query)
    if mission_query.patterns:
        params[Params.MISSION_PATTERNS.value] = mission_query.patterns
    if mission_query.ids:
        params[Params.MISSION_IDS.value] = list(map(str, mission_query.ids))
    return params


def _file_query_to_params(file_query: FileQuery) -> Dict[str, List[str]]:
    params = _mission_query_to_params(file_query.mission_query)
    if file_query.patterns:
        params[Params.FILE_PATTERNS.value] = list(file_query.patterns)
    if file_query.ids:
        params[Params.FILE_IDS.value] = list(map(str, file_query.ids))
    return params


def get_files(
    client: AuthenticatedClient,
    file_query: FileQuery,
    max_entries: Optional[int] = None,
) -> Generator[File, None, None]:
    params = _file_query_to_params(file_query)
    response_stream = paginated_request(client, FILE_ENDPOINT, params=params, max_entries=max_entries)
    yield from map(lambda f: _parse_file(FileObject(f)), response_stream)


def get_missions(
    client: AuthenticatedClient,
    mission_query: MissionQuery,
    max_entries: Optional[int] = None,
) -> Generator[Mission, None, None]:
    params = _mission_query_to_params(mission_query)
    response_stream = paginated_request(client, MISSION_ENDPOINT, params=params, max_entries=max_entries)
    yield from map(lambda m: _parse_mission(MissionObject(m)), response_stream)


def get_projects(
    client: AuthenticatedClient,
    project_query: ProjectQuery,
    max_entries: Optional[int] = None,
    exact_match: bool = False,
) -> Generator[Project, None, None]:
    params = _project_query_to_params(project_query)
    response_stream = paginated_request(
        client,
        PROJECT_ENDPOINT,
        params=params,
        max_entries=max_entries,
        exact_match=exact_match,
    )
    yield from map(lambda p: _parse_project(ProjectObject(p)), response_stream)


LIST_ACTIONS_ENDPOINT = "/actions"


def get_executions(
    client: AuthenticatedClient,
    query: Optional[ExecutionQuery] = None,
) -> Generator[Execution, None, None]:
    #Currently the backend does not support filtering executions by mission/project. So as of now the query is ignored and all executions are returned. In the future when the backend supports filtering, the query parameters should be passed to the paginated_request as params.
    response_stream = paginated_request(client, LIST_ACTIONS_ENDPOINT)
    yield from map(lambda p: _parse_execution(ExecutionObject(p)), response_stream)


def get_execution(
    client: AuthenticatedClient,
    execution_id: str,
) -> Execution:
    resp = client.get(f"{ACTION_ENDPOINT}s/{execution_id}")
    if resp.status_code == 404:
        raise kleinkram.errors.ExecutionNotFound(f"Execution not found: {execution_id}")
    resp.raise_for_status()
    execution_object = resp.json()

    try:
        logs_resp = client.get(f"{ACTION_ENDPOINT}s/{execution_id}/logs")
        if logs_resp.status_code == 200:
            execution_object["logs"] = logs_resp.json().get("data", [])
    except Exception:
        pass

    return _parse_execution(ExecutionObject(execution_object))


def get_template_revisions(
    client: AuthenticatedClient,
    template_id: str,
) -> Generator[ActionTemplate, None, None]:
    try:
        response_stream = paginated_request(client, f"/templates/{template_id}/revisions")
        yield from map(lambda p: _parse_action_template(p), response_stream)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise kleinkram.errors.TemplateNotFound(f"Template not found: {template_id}")
        raise


def get_template(
    client: AuthenticatedClient,
    template_id: str,
) -> ActionTemplate:
    # the backend does not expose a single GET /templates/:uuid endpoint
    # fetching its revisions and filtering is the most efficient available method
    for template in get_template_revisions(client, template_id):
        if str(template.uuid) == template_id:
            return template

    raise kleinkram.errors.TemplateNotFound(f"Template not found: {template_id}")


def get_templates(
    client: AuthenticatedClient,
) -> Generator[ActionTemplate, None, None]:
    response_stream = paginated_request(client, "/templates")
    yield from map(lambda p: _parse_action_template(p), response_stream)


def get_project(client: AuthenticatedClient, query: ProjectQuery, exact_match: bool = False) -> Project:
    """\
    get a unique project by specifying a project spec
    """
    if not project_query_is_unique(query):
        raise InvalidProjectQuery(f"Project query does not uniquely determine project: {query}")
    try:
        return next(get_projects(client, query, exact_match=exact_match))
    except StopIteration:
        raise ProjectNotFound(f"Project not found: {query}")


def get_mission(client: AuthenticatedClient, query: MissionQuery) -> Mission:
    """\
    get a unique mission by specifying a mission query
    """
    if not mission_query_is_unique(query):
        raise InvalidMissionQuery(f"Mission query does not uniquely determine mission: {query}")
    try:
        return next(get_missions(client, query))
    except StopIteration:
        raise MissionNotFound(f"Mission not found: {query}")


def get_file(client: AuthenticatedClient, query: FileQuery) -> File:
    """\
    get a unique file by specifying a file query
    """
    if not file_query_is_unique(query):
        raise InvalidFileQuery(f"File query does not uniquely determine file: {query}")
    try:
        return next(get_files(client, query))
    except StopIteration:
        raise kleinkram.errors.FileNotFound(f"File not found: {query}")


def _launch_execution(client: AuthenticatedClient, mission_uuid: UUID, template_uuid: UUID) -> str:
    """
    Submits a new action to the API and returns the action UUID.

    Raises:
        httpx.HTTPStatusError: If the API returns an error.
        KeyError: If the response is missing 'actionUUID'.
    """
    submit_payload = {
        "missionUUID": str(mission_uuid),
        "templateUUID": str(template_uuid),
    }

    resp = client.post(f"{ACTION_ENDPOINT}s", json=submit_payload)
    resp.raise_for_status()  # Raises on 4xx/5xx responses

    response_data = resp.json()
    execution_uuid_str = response_data.get("actionUUID")

    if not execution_uuid_str:
        raise KeyError("API response missing 'actionUUID'")

    return execution_uuid_str




def _create_template_version(
    client: AuthenticatedClient,
    template_id: UUID,
    name: str,
    description: str,
    docker_image: str,
    cpu_cores: int,
    cpu_memory_gb: int,
    gpu_memory_gb: int,
    max_runtime_minutes: int,
    access_rights: int,
    command: Optional[str] = None,
    entrypoint: Optional[str] = None,
) -> UUID:
    payload = {
        "uuid": str(template_id),
        "name": name,
        "description": description,
        "dockerImage": docker_image,
        "cpuCores": cpu_cores,
        "cpuMemory": cpu_memory_gb,
        "gpuMemory": gpu_memory_gb,
        "maxRuntime": max_runtime_minutes,
        "accessRights": access_rights,
    }

    if command is not None:
        payload["command"] = command
    if entrypoint is not None:
        payload["entrypoint"] = entrypoint

    resp = client.post(f"/templates/{template_id}/versions", json=payload)
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def _create_template(
    client: AuthenticatedClient,
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
) -> UUID:
    payload = {
        "name": name,
        "description": description,
        "dockerImage": docker_image,
        "cpuCores": cpu_cores,
        "cpuMemory": cpu_memory_gb,
        "gpuMemory": gpu_memory_gb,
        "maxRuntime": max_runtime_minutes,
        "accessRights": access_rights,
    }

    if command is not None:
        payload["command"] = command
    if entrypoint is not None:
        payload["entrypoint"] = entrypoint

    resp = client.post("/templates", json=payload)
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def _create_mission(
    client: AuthenticatedClient,
    project_id: UUID,
    mission_name: str,
    *,
    tags: Dict[UUID, str],
    ignore_missing_tags: bool = False,
) -> UUID:
    payload = {
        "name": mission_name,
        "projectUUID": str(project_id),
        "tags": {str(k): v for k, v in tags.items()},
        "ignoreTags": ignore_missing_tags,
    }
    resp = client.post(CREATE_MISSION, json=payload)
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def _create_project(client: AuthenticatedClient, project_name: str, description: str) -> UUID:
    payload = {"name": project_name, "description": description}
    resp = client.post(CREATE_PROJECT, json=payload)
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)

    # TODO: add check for LOCATION tag datatype


def _update_mission(client: AuthenticatedClient, mission_id: UUID, *, tags: Dict[UUID, str]) -> None:
    payload = {
        "missionUUID": str(mission_id),
        "tags": {str(k): v for k, v in tags.items()},
    }
    resp = client.post(UPDATE_MISSION, json=payload)

    if resp.status_code == 404:
        raise MissionNotFound
    if resp.status_code == 403:
        raise AccessDenied(f"cannot update mission: {mission_id}")

    resp.raise_for_status()


def _update_project(
    client: AuthenticatedClient,
    project_id: UUID,
    *,
    description: Optional[str] = None,
    new_name: Optional[str] = None,
) -> None:
    if description is None and new_name is None:
        raise ValueError("either description or new_name must be provided")

    body = {}
    if description is not None:
        body["description"] = description
    if new_name is not None:
        body["name"] = new_name
    resp = client.put(f"{UPDATE_PROJECT}/{project_id}", json=body)
    resp.raise_for_status()


def _get_api_version() -> Tuple[int, int, int]:
    config = get_config()
    client = httpx.Client()

    resp = client.get(f"{config.endpoint.api}{GET_STATUS}", headers={CLI_VERSION_HEADER: __version__})
    vers_str = resp.headers.get("kleinkram-version")

    if not vers_str:
        return (0, 0, 0)

    vers = vers_str.split(".")

    try:
        return tuple(map(int, vers))  # type: ignore
    except ValueError:
        return (0, 0, 0)


def _claim_admin(client: AuthenticatedClient) -> None:
    """\
    the first user on the system could call this
    """
    response = client.post(CLAIM_ADMIN)
    response.raise_for_status()
    return


FILE_DELETE_MANY = "/files/deleteMultiple"


def _delete_files(client: AuthenticatedClient, file_ids: Sequence[UUID], mission_id: UUID) -> None:
    payload = {
        "uuids": [str(file_id) for file_id in file_ids],
        "missionUUID": str(mission_id),
    }
    resp = client.post(FILE_DELETE_MANY, json=payload)
    resp.raise_for_status()


MISSION_DELETE_ONE = "/missions/{}"


def _delete_mission(client: AuthenticatedClient, mission_id: UUID) -> None:
    resp = client.delete(MISSION_DELETE_ONE.format(mission_id))

    # 409 is returned if the mission has files
    # 403 is returned if the mission does not exist / user cant delete

    resp.raise_for_status()


PROJECT_DELETE_ONE = "/projects/{}"


def _delete_project(client: AuthenticatedClient, project_id: UUID) -> None:
    resp = client.delete(PROJECT_DELETE_ONE.format(project_id))
    resp.raise_for_status()


TEMPLATE_DELETE_ONE = "/templates/{}"

def _delete_template(client: AuthenticatedClient, template_id: UUID) -> None:
    resp = client.delete(TEMPLATE_DELETE_ONE.format(template_id))
    if resp.status_code == 404:
        raise TemplateNotFound(f"Template not found: {template_id}")
    resp.raise_for_status()

EXECUTION_DELETE_ONE = "/actions/{}"

def _delete_execution(client: AuthenticatedClient, execution_id: UUID) -> None:
    resp = client.delete(EXECUTION_DELETE_ONE.format(execution_id))
    if resp.status_code == 404:
        raise kleinkram.errors.ExecutionNotFound(f"Execution not found: {execution_id}")
    resp.raise_for_status()