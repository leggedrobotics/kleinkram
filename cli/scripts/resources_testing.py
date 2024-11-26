from __future__ import annotations

from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.models import files_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from kleinkram.resources import get_files


def main():
    client = AuthenticatedClient()

    ps = ProjectSpec(patterns=["*"])
    ms = MissionSpec(project_spec=ps)
    fs = FileSpec(mission_spec=ms, patterns=["*.bag"])

    files = get_files(client, fs)

    Console().print(files_to_table(files))


if __name__ == "__main__":
    main()
