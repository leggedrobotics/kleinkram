from typing import Optional, Annotated

import httpx
import typer

from kleinkram.api_client import AuthenticatedClient

file = typer.Typer(
    name="file",
    help="File operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@file.command("list")
def list_files(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    mission: Optional[str] = typer.Option(None, help="Name of Mission"),
    topics: Optional[str] = typer.Option(None, help="Comma separated list of topics"),
    tags: Optional[str] = typer.Option(
        None, help="Comma separated list of tagtype:tagvalue pairs"
    ),
):
    """
    List all files with optional filters for project, mission, or topics.

    Can list files of a project, mission, or with specific topics (Logical AND).
    Examples:\n
        - 'klein filelist'\n
        - 'klein file list --project "Project 1"'\n
        - 'klein file list --mission "Mission 1"'\n
        - 'klein file list --topics "/elevation_mapping/semantic_map,/elevation_mapping/elevation_map_raw"'\n
        - 'klein file list --topics "/elevation_mapping/semantic_map,/elevation_mapping/elevation_map_raw" --mission "Mission A"'
    """
    try:
        url = f"/file/filteredByNames"
        params = {}
        if project:
            params["projectName"] = project
        if mission:
            params["missionName"] = mission
        if topics:
            params["topics"] = topics
        if tags:
            params["tags"] = {}
            for tag in tags.split(","):
                tagtype, tagvalue = tag.split("§")
                params["tags"][tagtype] = tagvalue

        client = AuthenticatedClient()
        response = client.get(
            url,
            params=params,
        )
        response.raise_for_status()
        data = response.json()
        missions_by_project_uuid = {}
        files_by_mission_uuid = {}
        for file in data:
            mission_uuid = file["mission"]["uuid"]
            project_uuid = file["mission"]["project"]["uuid"]
            if project_uuid not in missions_by_project_uuid:
                missions_by_project_uuid[project_uuid] = []
            if mission_uuid not in missions_by_project_uuid[project_uuid]:
                missions_by_project_uuid[project_uuid].append(mission_uuid)
            if mission_uuid not in files_by_mission_uuid:
                files_by_mission_uuid[mission_uuid] = []
            files_by_mission_uuid[mission_uuid].append(file)

        print("Files by mission & Project:")
        for project_uuid, missions in missions_by_project_uuid.items():
            first_file = files_by_mission_uuid[missions[0]][0]
            print(f"* {first_file['mission']['project']['name']}")
            for mission in missions:
                print(f"  - {files_by_mission_uuid[mission][0]['mission']['name']}")
                for file in files_by_mission_uuid[mission]:
                    print(f"    - '{file['filename']}'")

    except httpx.HTTPError as e:
        print(f"Failed to fetch missions: {e}")


@file.command("download")
def download(
    missionuuid: Annotated[str, typer.Argument()],
):
    """Download file"""
    try:
        client = AuthenticatedClient()
        response = client.get("/file/downloadWithToken", params={"uuid": missionuuid})
        response.raise_for_status()
        print(response.json())
    except:
        print("Failed to download file")


@file.command("clear")
def clear_queue():
    """Clear queue"""
    # Prompt the user for confirmation
    confirmation = typer.prompt("Are you sure you want to clear the Files? (y/n)")
    if confirmation.lower() == "y":
        client = AuthenticatedClient()
        response = client.delete("/file/clear")
        response.raise_for_status()
        print("Files cleared.")
    else:
        print("Operation cancelled.")
