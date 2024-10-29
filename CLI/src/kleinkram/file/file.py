import os
from typing_extensions import Optional, Annotated, List

import httpx
import requests
import typer

from kleinkram.api_client import AuthenticatedClient
from kleinkram.error_handling import AccessDeniedException

file = typer.Typer(
    name="file",
    help="File operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@file.command("download")
def download_file(
    file_uuid: Annotated[List[str], typer.Option(help="UUIDs of the files")],
    local_path: Annotated[
        str,
        typer.Option(
            prompt=True,
            help="Local path to save the file",
        ),
    ],
):
    """
    Download files by UUIDs to a local path.\n
    Examples:\n
    klein file download --file-uuid="9d5a9..."  --file-uuid="9833f..." --local-path="~/Downloads" \n
    klein file download --file-uuid="9d5a9..."  --local-path="~/Downloads/example.bag"

    """
    client = AuthenticatedClient()
    url = f"/file/download"

    fixed_local_path = os.path.expanduser(local_path)

    isDir = os.path.isdir(fixed_local_path)
    chunk_size = 1024 * 100  # 100 KB chunks, adjust size if needed

    for file in file_uuid:
        response = client.get(
            url,
            params={"uuid": file, "expires": True},
        )
        if response.status_code >= 400:
            raise AccessDeniedException(
                f"Failed to download file: {response.json()['message']}",
                "Status Code: " + str(response.status_code),
            )
        download_url = response.text
        if isDir:
            filename = download_url.split("/")[6].split("?")[0]  # Trust me bro
            filepath = os.path.join(fixed_local_path, filename)
        elif not isDir and len(file_uuid) == 1:
            filepath = fixed_local_path
        else:
            raise ValueError("Multiple files can only be downloaded to a directory")
        if os.path.exists(filepath):
            raise FileExistsError(f"File already exists: {filepath}")
        print(f"Downloading to: {filepath}")
        filestream = requests.get(download_url, stream=True)
        with open(filepath, "wb") as f:
            for chunk in filestream.iter_content(chunk_size=chunk_size):
                if chunk:  # Filter out keep-alive new chunks
                    f.write(chunk)
            print(f"Completed")


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
        - 'klein file list --project "Project_1"'\n
        - 'klein file list --mission "Mission_1"'\n
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
        if response.status_code >= 400:
            raise AccessDeniedException(
                f"Failed to fetch files: {response.json()['message']} ({response.status_code})",
                "Access Denied",
            )
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
        raise e
