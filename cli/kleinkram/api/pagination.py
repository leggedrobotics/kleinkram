from __future__ import annotations

from typing import Any
from typing import Dict
from typing import Generator
from typing import List
from typing import Mapping
from typing import Optional
from typing import Tuple
from typing import cast

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.deser import _parse_file
from kleinkram.api.deser import _parse_mission
from kleinkram.api.deser import _parse_project
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.resources import FileSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec

PAGE_SIZE = 100


def paginated_request(
    client: AuthenticatedClient,
    endpoint: str,
    max_entries: Optional[int] = None,
    params: Optional[Mapping[str, str]] = None,
) -> Generator[Dict[Any, Any], None, None]:
    count = 0

    params = dict(params or {})
    params["take"] = str(PAGE_SIZE)
    params["skip"] = str(0)

    while True:
        resp = client.get(endpoint, params=params)
        resp.raise_for_status()
        block, more = cast(Tuple[List[Dict[Any, Any]], int], resp.json())

        for entry in block:
            count += 1
            yield entry
            if max_entries is not None and max_entries <= count:
                return
        if not more:
            return
        params["skip"] = str(count)


def _project_spec_to_params(
    project_spec: ProjectSpec,
) -> Dict[str, Any]:
    params = {}
    if project_spec.patterns is not None:
        params["projectPatterns"] = project_spec.patterns
    if project_spec.ids is not None:
        params["projectUUIDs"] = list(map(str, project_spec.ids))
    return params


def _mission_spec_to_params(mission_spec: MissionSpec) -> Dict[str, Any]:
    params = _project_spec_to_params(mission_spec.project_spec)
    if mission_spec.patterns is not None:
        params["missionPatterns"] = mission_spec.patterns
    if mission_spec.ids is not None:
        params["missionUUIDs"] = list(map(str, mission_spec.ids))
    return params


def _file_spec_to_params(file_spec: FileSpec) -> Dict[str, str]:
    params = _mission_spec_to_params(file_spec.mission_spec)
    if file_spec.patterns is not None:
        params["filePatterns"] = file_spec.patterns
    if file_spec.ids is not None:
        params["fileUUIDs"] = list(map(str, file_spec.ids))
    return params


FILE_ENDPOINT = "/TODO"
MISSION_ENDPOINT = "/TODO"
PROJECT_ENDPOINT = "/TODO"


def _get_files(
    client: AuthenticatedClient, file_spec: FileSpec, max_entries: Optional[int] = None
) -> Generator[File, None, None]:
    params = _file_spec_to_params(file_spec)
    yield from map(
        _parse_file,
        paginated_request(
            client, FILE_ENDPOINT, params=params, max_entries=max_entries
        ),
    )


def _get_missions(
    client: AuthenticatedClient,
    mission_spec: MissionSpec,
    max_entries: Optional[int] = None,
) -> Generator[Mission, None, None]:
    params = _mission_spec_to_params(mission_spec)
    yield from map(
        _parse_mission,
        paginated_request(
            client, MISSION_ENDPOINT, params=params, max_entries=max_entries
        ),
    )


def _get_projects(
    client: AuthenticatedClient,
    project_spec: ProjectSpec,
    max_entries: Optional[int] = None,
) -> Generator[Project, None, None]:
    params = _project_spec_to_params(project_spec)
    yield from map(
        _parse_project,
        paginated_request(
            client, PROJECT_ENDPOINT, params=params, max_entries=max_entries
        ),
    )
