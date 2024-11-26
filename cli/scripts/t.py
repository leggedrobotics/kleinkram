from __future__ import annotations

from uuid import UUID
from uuid import uuid4

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import _delete_mission
from kleinkram.core import delete_mission

MISSION_ID = "fc24d9d5-d46b-435b-9d91-2ee549233fc2"
MISSION_ID = "aa57e695-6e46-4d5f-9b70-f3a6923cf4bb"

delete_mission(MISSION_ID)


# _delete_mission(AuthenticatedClient(), UUID(MISSION_ID))
