from __future__ import annotations

from kleinkram.utils import UploadAccess
from uuid import UUID
from typing import Dict
from kleinkram.api.client import AuthenticatedClient

TEMP_CREDS_ENDPOINT = "/file/temporaryAccess"
CLAIM_ADMIN_ENDPOINT = "/user/claimAdmin"


def get_upload_creditials(
    client: AuthenticatedClient, internal_filenames: list[str], mission_id: UUID
) -> Dict[str, UploadAccess]:
    if mission_id.version != 4:
        raise ValueError("Mission ID must be a UUIDv4")
    dct = {
        "filenames": internal_filenames,
        "missionUUID": str(mission_id),
    }
    resp = client.post(TEMP_CREDS_ENDPOINT, json=dct)

    if resp.status_code >= 400:
        raise ValueError(
            "Failed to get temporary credentials. Status Code: "
            f"{resp.status_code}\n{resp.json()['message'][0]}"
        )

    return resp.json()  # type: ignore


def claim_admin() -> None:
    client = AuthenticatedClient()
    response = client.post(CLAIM_ADMIN_ENDPOINT)
    response.raise_for_status()
    return
