import sys
from typing import Annotated, Optional

import httpx
import typer
from rich.console import Console
from rich.table import Table

from kleinkram.api_client import AuthenticatedClient

mission = typer.Typer(
    name="mission",
    help="Mission operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@mission.command("tag")
def addTag(
    missionuuid: Annotated[str, typer.Argument()],
    tagtypeuuid: Annotated[str, typer.Argument()],
    value: Annotated[str, typer.Argument()],
):
    """Tag a mission"""
    try:
        client = AuthenticatedClient()
        response = client.post(
            "/tag/addTag",
            json={"mission": missionuuid, "tagType": tagtypeuuid, "value": value},
        )
        if response.status_code < 400:
            print("Tagged mission")
        else:
            print(response.json())
            print("Failed to tag mission")
    except httpx.HTTPError as e:
        print(e)
        print("Failed to tag mission")
        sys.exit(1)


@mission.command("list")
def list_missions(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    verbose: Optional[bool] = typer.Option(
        False, help="Outputs a table with more information"
    ),
):
    """
    List all missions with optional filter for project.
    """
    try:
        url = "/mission"
        if project:
            url += f"/filteredByProjectName/{project}"
        else:
            url += "/all"
            client = AuthenticatedClient()

        response = client.get(url)
        response.raise_for_status()
        data = response.json()
        missions_by_project_uuid = {}
        for mission in data:
            project_uuid = mission["project"]["uuid"]
            if project_uuid not in missions_by_project_uuid:
                missions_by_project_uuid[project_uuid] = []
            missions_by_project_uuid[project_uuid].append(mission)

        print("missions by Project:")
        if not verbose:
            for project_uuid, missions in missions_by_project_uuid.items():
                print(
                    f"* {missions_by_project_uuid[project_uuid][0]['project']['name']}"
                )
                for mission in missions:
                    print(f"  - {mission['name']}")
        else:
            table = Table("UUID", "name", "project", "creator", "createdAt")
            for project_uuid, missions in missions_by_project_uuid.items():
                for mission in missions:
                    table.add_row(
                        mission["uuid"],
                        mission["name"],
                        mission["project"]["name"],
                        mission["creator"]["name"],
                        mission["createdAt"],
                    )
            print(table)

    except httpx.HTTPError as e:
        print(f"Failed to fetch missions: {e}")


@mission.command("byUUID")
def mission_by_uuid(
    uuid: Annotated[str, typer.Argument()],
    json: Optional[bool] = typer.Option(False, help="Output as JSON"),
):
    """
    Get mission name, project name, creator and table of its files given a Mission UUID

    Use the JSON flag to output the full JSON response instead.

    Can be run with API Key or with login.
    """
    try:
        url = "/mission/byUUID"
        client = AuthenticatedClient()
        response = client.get(url, params={"uuid": uuid})
        response.raise_for_status()
        data = response.json()
        if json:
            print(data)
        else:
            print(f"mission: {data['name']}")
            print(f"Creator: {data['creator']['name']}")
            print("Project: " + data["project"]["name"])
            table = Table("Filename", "Size", "date")
            for file in data["files"]:
                table.add_row(file["filename"], f"{file['size']}", file["date"])
            console = Console()
            console.print(table)
    except httpx.HTTPError as e:
        print(f"Failed to fetch missions: {e}")
