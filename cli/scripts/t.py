from __future__ import annotations

from uuid import UUID
from uuid import uuid4

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.pagination import _get_files_paginated
from kleinkram.api.pagination import _get_missions_paginated
from kleinkram.api.pagination import _get_projects_paginated
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery

ps = ProjectQuery()
ms = MissionQuery()
fs = FileQuery()

client = AuthenticatedClient()


for project in _get_projects_paginated(client, ps):
    print(project)


for mission in _get_missions_paginated(client, ms):
    print(mission)


for file in _get_files_paginated(client, fs):
    print(file)
