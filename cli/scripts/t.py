from __future__ import annotations

from uuid import UUID
from uuid import uuid4

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import _delete_mission
from kleinkram.core import delete_mission
from kleinkram.core import delete_project

MISSION_ID = "fc24d9d5-d46b-435b-9d91-2ee549233fc2"
MISSION_ID = "aa57e695-6e46-4d5f-9b70-f3a6923cf4bb"

MISSION_ID = "2a029617-085d-4b06-b351-a33217a36968"
MISSION_ID = "6d5f8184-165a-4251-8adf-040a1e232adf"

PROJECT_ID = "b5367a14-7f2e-4997-9ef1-6c0a96300710"

# delete_mission(MISSION_ID)
delete_project(PROJECT_ID)
