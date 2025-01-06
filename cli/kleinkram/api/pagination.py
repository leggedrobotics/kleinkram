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
from kleinkram.api.deser import _parse_project, ProjectObject, MissionObject, FileObject
from kleinkram.models import File
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.api.query import FileSpec
from kleinkram.api.query import MissionSpec
from kleinkram.api.query import ProjectSpec

PAGE_SIZE = 128

SKIP = "skip"
TAKE = "take"

Entry = Dict[str, Any]


def paginated_request(
    client: AuthenticatedClient,
    endpoint: str,
    max_entries: Optional[int] = None,
    params: Optional[Mapping[str, str]] = None,
) -> Generator[Entry, None, None]:
    total_entries_count = 0

    params = dict(params or {})
    params[TAKE] = str(PAGE_SIZE)
    params[SKIP] = str(0)

    while True:
        resp = client.get(endpoint, params=params)
        resp.raise_for_status()
        responses_block, entries_left = cast(Tuple[List[Entry], int], resp.json())

        for entry in responses_block:
            total_entries_count += 1
            yield entry

            if max_entries is not None and max_entries <= total_entries_count:
                return

        if not entries_left:
            return

        params[SKIP] = str(total_entries_count)


# TODO: move the stuff below somewhere else


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


FILE_ENDPOINT = "/file/many"
MISSION_ENDPOINT = "/mission/many"
PROJECT_ENDPOINT = "/project/many"


def _get_files_paginated(
    client: AuthenticatedClient,
    file_spec: FileSpec,
    mission: Mission,
    max_entries: Optional[int] = None,
) -> Generator[File, None, None]:
    params = _file_spec_to_params(file_spec)
    response_stream = paginated_request(
        client, FILE_ENDPOINT, params=params, max_entries=max_entries
    )

    yield from map(
        lambda f: _parse_file(FileObject(f), mission),
        response_stream,
    )


def _get_missions_paginated(
    client: AuthenticatedClient,
    mission_spec: MissionSpec,
    project: Project,
    max_entries: Optional[int] = None,
) -> Generator[Mission, None, None]:
    params = _mission_spec_to_params(mission_spec)
    response_stream = paginated_request(
        client, MISSION_ENDPOINT, params=params, max_entries=max_entries
    )

    yield from map(
        lambda m: _parse_mission(MissionObject(m), project),
        response_stream,
    )


def _get_projects_paginated(
    client: AuthenticatedClient,
    project_spec: ProjectSpec,
    max_entries: Optional[int] = None,
) -> Generator[Project, None, None]:
    params = _project_spec_to_params(project_spec)
    _response_stream = paginated_request(
        client, PROJECT_ENDPOINT, params=params, max_entries=max_entries
    )
    yield from map(lambda p: _parse_project(ProjectObject(p)), _response_stream)
