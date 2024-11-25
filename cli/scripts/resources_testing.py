from __future__ import annotations

from kleinkram.api.client import AuthenticatedClient
from kleinkram.models import files_to_table
from kleinkram.models import missions_to_table
from kleinkram.models import projects_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import get_files_by_spec
from kleinkram.resources import get_missions_by_spec
from kleinkram.resources import get_projects_by_spec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from rich.console import Console


def main():
    client = AuthenticatedClient()

    ps = ProjectSpec(project_filters=["*"])
    ms = MissionSpec(project_spec=ps)
    fs = FileSpec(mission_spec=ms, file_filters=["*.bag"])

    files = get_files_by_spec(client, fs)

    Console().print(files_to_table(files))


if __name__ == "__main__":
    main()
