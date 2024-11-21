from __future__ import annotations

import logging
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Tuple
from uuid import UUID

import httpx
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import Config
from kleinkram.errors import MissionDoesNotExist
from kleinkram.errors import MissionExists
from kleinkram.errors import NoPermission
from kleinkram.errors import ParseError
from kleinkram.models import DataType
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.models import TagType
from kleinkram.utils import is_valid_uuid4

__all__ = [
    "_get_projects",
    "_get_missions_by_project",
    "_get_files_by_mission",
    "_create_mission",
    "_update_mission_metadata",
    "_get_api_version",
    "_claim_admin",
]

logger = logging.getLogger(__name__)


MAX_PAGINATION = 10_000

CLAIM_ADMIN = "/user/claimAdmin"
PROJECT_ALL = "/project/filtered"
MISSIONS_BY_PROJECT = "/mission/filter"
MISSION_BY_NAME = "/mission/byName"
MISSION_CREATE = "/mission/create"
MISSION_UPDATE_METADATA = "/mission/tags"
FILE_OF_MISSION = "/file/ofMission"
TAG_TYPE_BY_NAME = "/tag/filtered"
GET_STATUS = "/user/me"


def _parse_project(project: Dict[str, Any]) -> Project:
    try:
        project_id = UUID(project["uuid"], version=4)
        project_name = project["name"]
        project_description = project["description"]

        parsed = Project(
            id=project_id, name=project_name, description=project_description
        )
    except Exception:
        raise ParseError(f"error parsing project: {project}")
    return parsed


def _parse_mission(
    mission: Dict[str, Any], project: Optional[Project] = None
) -> Mission:
    try:
        mission_id = UUID(mission["uuid"], version=4)
        mission_name = mission["name"]

        project_id = (
            project.id if project else UUID(mission["project"]["uuid"], version=4)
        )
        project_name = project.name if project else mission["project"]["name"]

        parsed = Mission(
            id=mission_id,
            name=mission_name,
            project_id=project_id,
            project_name=project_name,
        )
    except Exception:
        raise ParseError(f"error parsing mission: {mission}")
    return parsed


def _parse_file(file: Dict[str, Any], mission: Optional[Mission] = None) -> File:
    try:
        filename = file["filename"]
        file_id = UUID(file["uuid"], version=4)
        file_size = file["size"]
        file_hash = file["hash"]

        project_id = (
            mission.project_id if mission else UUID(file["project"]["uuid"], version=4)
        )
        project_name = mission.project_name if mission else file["project"]["name"]

        mission_id = mission.id if mission else UUID(file["mission"]["uuid"], version=4)
        mission_name = mission.name if mission else file["mission"]["name"]

        parsed = File(
            id=file_id,
            name=filename,
            size=file_size,
            hash=file_hash,
            project_id=project_id,
            project_name=project_name,
            mission_id=mission_id,
            mission_name=mission_name,
            state=FileState(file["state"]),
        )
    except Exception:
        raise ParseError(f"error parsing file: {file}")

    return parsed


def _get_projects(client: AuthenticatedClient) -> list[Project]:
    resp = client.get(PROJECT_ALL)

    if resp.status_code in (403, 404):
        return []

    resp.raise_for_status()

    ret = []
    for pr in resp.json()[0]:
        ret.append(_parse_project(pr))

    return ret


def _get_missions_by_project(
    client: AuthenticatedClient, project: Project
) -> List[Mission]:
    params = {"uuid": str(project.id), "take": MAX_PAGINATION}

    resp = client.get(MISSIONS_BY_PROJECT, params=params)

    if resp.status_code in (403, 404):
        return []

    resp.raise_for_status()

    data = resp.json()
    missions = []

    for mission in data[0]:
        missions.append(_parse_mission(mission, project))

    return missions


def _get_files_by_mission(client: AuthenticatedClient, mission: Mission) -> List[File]:
    params = {"uuid": str(mission.id), "take": MAX_PAGINATION}

    resp = client.get(FILE_OF_MISSION, params=params)

    if resp.status_code in (403, 404):
        return []

    resp.raise_for_status()

    data = resp.json()

    files = []
    for file in data[0]:
        files.append(_parse_file(file, mission))

    return files


def _get_mission_id_by_name(
    client: AuthenticatedClient, mission_name, project_id: UUID
) -> Optional[UUID]:
    params = {"name": mission_name, "projectUUID": str(project_id)}
    resp = client.get(MISSION_BY_NAME, params=params)

    if resp.status_code in (403, 404):
        return None

    # TODO: handle other status codes
    resp.raise_for_status()

    data = resp.json()

    return UUID(data["uuid"], version=4)


def _create_mission(
    client: AuthenticatedClient,
    project_id: UUID,
    mission_name: str,
    *,
    metadata: Optional[Dict[str, str]] = None,
    ignore_missing_tags: bool = False,
) -> UUID:
    """\
    creates a new mission with the given name and project_id

    if check_exists is True, the function will return the existing mission_id,
    otherwise if the mission already exists an error will be raised
    """
    if metadata is None:
        metadata = {}

    if _get_mission_id_by_name(client, mission_name, project_id) is not None:
        raise MissionExists(f"Mission with name: `{mission_name}` already exists")

    if is_valid_uuid4(mission_name):
        raise ValueError(
            f"Mission name: `{mission_name}` is a valid UUIDv4, "
            "mission names must not be valid UUIDv4's"
        )

    # we need to translate tag keys to tag type ids
    tags = _get_tags_map(client, metadata)

    payload = {
        "name": mission_name,
        "projectUUID": str(project_id),
        "tags": {str(k): v for k, v in tags.items()},
        "ignoreTags": ignore_missing_tags,
    }

    resp = client.post(MISSION_CREATE, json=payload)
    resp.raise_for_status()

    return UUID(resp.json()["uuid"], version=4)


def _get_tag_type_by_name(
    client: AuthenticatedClient, tag_name: str
) -> Optional[TagType]:
    resp = client.get(TAG_TYPE_BY_NAME, params={"name": tag_name, "take": 1})

    if resp.status_code in (403, 404):
        return None

    resp.raise_for_status()

    data = resp.json()[0]
    tag_type = TagType(
        name=data["name"],
        id=UUID(data["uuid"], version=4),
        data_type=DataType(data["datatype"]),
        description=data["description"],
    )
    return tag_type


def _get_tags_map(
    client: AuthenticatedClient, metadata: Dict[str, str]
) -> Dict[UUID, str]:
    # TODO: this needs a better endpoint
    ret = {}
    for key, val in metadata.items():
        tag_type = _get_tag_type_by_name(client, key)

        if tag_type is None:
            print(f"tag: {key} not found")
            continue

        ret[tag_type.id] = val

    return ret


def _update_mission_metadata(
    client: AuthenticatedClient, mission_id: UUID, *, metadata: Dict[str, str]
) -> None:
    tags_dct = _get_tags_map(client, metadata)
    payload = {
        "missionUUID": str(mission_id),
        "tags": {str(k): v for k, v in tags_dct.items()},
    }
    resp = client.post(MISSION_UPDATE_METADATA, json=payload)

    if resp.status_code == 404:
        raise MissionDoesNotExist

    if resp.status_code == 403:
        raise NoPermission

    resp.raise_for_status()


def _get_api_version() -> Tuple[int, int, int]:
    config = Config()
    client = httpx.Client()

    resp = client.get(f"{config.endpoint}{GET_STATUS}")
    vers = resp.headers["kleinkram-version"].split(".")

    return tuple(map(int, vers))  # type: ignore


def _claim_admin(client: AuthenticatedClient) -> None:
    """\
    the first user on the system could call this
    """
    response = client.post(CLAIM_ADMIN)
    response.raise_for_status()
    return
