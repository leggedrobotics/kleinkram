from __future__ import annotations

from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.printing import files_to_table
from kleinkram.api.query import FileSpec
from kleinkram.api.query import MissionSpec
from kleinkram.api.query import ProjectSpec
from kleinkram.api.query import get_files


def main():
    client = AuthenticatedClient()

    ps = ProjectSpec(patterns=["*"])
    ms = MissionSpec(project_spec=ps)
    fs = FileSpec(mission_spec=ms, patterns=["*.bag"])

    files = get_files(client, fs)

    Console().print(files_to_table(list(files)))


if __name__ == "__main__":
    main()
