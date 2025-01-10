from __future__ import annotations

from rich.console import Console

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.routes import get_files
from kleinkram.printing import files_to_table


def main():
    client = AuthenticatedClient()

    ps = ProjectQuery(patterns=["*"])
    ms = MissionQuery(project_query=ps)
    fs = FileQuery(mission_query=ms, patterns=["*.bag"])

    files = get_files(client, fs)

    Console().print(files_to_table(list(files)))


if __name__ == "__main__":
    main()
