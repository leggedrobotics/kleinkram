from __future__ import annotations

from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from typing import Tuple
from uuid import UUID

import httpx

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.deser import _parse_file
from kleinkram.api.deser import _parse_mission
from kleinkram.api.deser import _parse_project
from kleinkram.config import load_config
from kleinkram.errors import AccessDenied
from kleinkram.errors import MissionExists
from kleinkram.errors import MissionNotFound
from kleinkram.models import DataType
from kleinkram.models import File
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
    "_delete_files",
    "_delete_mission",
    "_delete_project",
]


MAX_PAGINATION = 10_000

CLAIM_ADMIN = "/user/claimAdmin"
PROJECT_ALL = "/project/filtered"
MISSIONS_BY_PROJECT = "/mission/filtered"
MISSION_BY_NAME = "/mission/byName"
MISSION_CREATE = "/mission/create"
MISSION_UPDATE_METADATA = "/mission/tags"
FILE_OF_MISSION = "/file/ofMission"
TAG_TYPE_BY_NAME = "/tag/filtered"
GET_STATUS = "/user/me"


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
        raise MissionNotFound

    if resp.status_code == 403:
        raise AccessDenied(f"cannot update mission: {mission_id}")

    resp.raise_for_status()


def _get_api_version() -> Tuple[int, int, int]:
    config = load_config()
    client = httpx.Client()

    resp = client.get(f"{config.endpoint.api}{GET_STATUS}")
    vers = resp.headers["kleinkram-version"].split(".")

    return tuple(map(int, vers))  # type: ignore


def _claim_admin(client: AuthenticatedClient) -> None:
    """\
    the first user on the system could call this
    """
    response = client.post(CLAIM_ADMIN)
    response.raise_for_status()
    return


FILE_DELETE_MANY = "/file/deleteMultiple"


def _delete_files(
    client: AuthenticatedClient, file_ids: Sequence[UUID], mission_id: UUID
) -> None:
    payload = {
        "uuids": [str(file_id) for file_id in file_ids],
        "missionUUID": str(mission_id),
    }
    resp = client.post(FILE_DELETE_MANY, json=payload)
    resp.raise_for_status()


MISSION_DELETE_ONE = "/mission/{}"


def _delete_mission(client: AuthenticatedClient, mission_id: UUID) -> None:
    resp = client.delete(MISSION_DELETE_ONE.format(mission_id))

    # 409 is returned if the mission has files
    # 403 is returned if the mission does not exist / user cant delete

    resp.raise_for_status()


PROJECT_DELETE_ONE = "/project/{}"


def _delete_project(client: AuthenticatedClient, project_id: UUID) -> None:
    resp = client.delete(PROJECT_DELETE_ONE.format(project_id))
    resp.raise_for_status()
