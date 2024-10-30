import os
import re

import httpx
import requests
import typer
from rich.console import Console
from rich.table import Table
from tqdm import tqdm
from typing_extensions import Annotated, Optional, List

from kleinkram.api_client import AuthenticatedClient
from kleinkram.error_handling import AccessDeniedException
from kleinkram.helper import expand_and_match, uploadFiles

missionCommands = typer.Typer(
    name="mission",
    help="Mission operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@missionCommands.command("tag")
def addTag(
    mission_uuid: Annotated[str, typer.Argument()],
    tagtype_uuid: Annotated[str, typer.Argument()],
    value: Annotated[str, typer.Argument()],
):
    """Tag a mission"""
    try:
        client = AuthenticatedClient()
        response = client.post(
            "/tag/addTag",
            json={"mission": mission_uuid, "tagType": tagtype_uuid, "value": value},
        )
        if response.status_code < 400:
            print("Tagged mission")
        else:
            print(response.json())
            print("Failed to tag mission")
            raise Exception("Failed to tag mission")
    except httpx.HTTPError as e:
        print(e)
        print("Failed to tag mission")
        raise e


@missionCommands.command("list")
def list_missions(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    table: Optional[bool] = typer.Option(
        True, help="Outputs a table with more information"
    ),
):
    """
    List all missions with optional filter for project.
    """

    url = "/mission"
    params = {}
    if project:
        url += f"/filteredByProjectName"
        params["projectName"] = project
    else:
        url += "/all"

    client = AuthenticatedClient()

    try:

        response = client.get(url, params=params)
        response.raise_for_status()

    except httpx.HTTPError:

        raise AccessDeniedException(
            f"Failed to fetch mission."
            f"Consider using the following command to list all missions: 'klein mission list --verbose'\n",
            f"{response.json()['message']} ({response.status_code})",
        )

    data = response.json()
    missions_by_project_uuid = {}
    for mission in data:
        project_uuid = mission["project"]["uuid"]
        if project_uuid not in missions_by_project_uuid:
            missions_by_project_uuid[project_uuid] = []
        missions_by_project_uuid[project_uuid].append(mission)

    if len(missions_by_project_uuid.items()) == 0:
        print(f"No missions found for project '{project}'. Does it exist?")
        return

    print("missions by Project:")
    if not table:
        for project_uuid, missions in missions_by_project_uuid.items():
            print(f"* {missions_by_project_uuid[project_uuid][0]['project']['name']}")
            for mission in missions:
                print(f"  - {mission['name']}")

    else:
        table = Table(
            "project",
            "name",
            "UUID",
            "creator",
            "createdAt",
            title="Missions",
            expand=True,
        )
        for project_uuid, missions in missions_by_project_uuid.items():
            for mission in missions:
                table.add_row(
                    mission["project"]["name"],
                    mission["name"],
                    mission["uuid"],
                    mission["creator"]["name"],
                    mission["createdAt"],
                )
        console = Console()
        console.print(table)


@missionCommands.command("byUUID")
def mission_by_uuid(
    uuid: Annotated[str, typer.Argument()],
    json: Optional[bool] = typer.Option(False, help="Output as JSON"),
):
    """
    Get mission name, project name, creator and table of its files given a Mission UUID

    Use the JSON flag to output the full JSON response instead.

    Can be run with API Key or with login.
    """
    url = "/mission/one"
    client = AuthenticatedClient()
    response = client.get(url, params={"uuid": uuid})

    try:
        response.raise_for_status()
    except httpx.HTTPError:
        raise AccessDeniedException(
            f"Failed to fetch mission. "
            f"Consider using the following command to list all missions: 'klein mission list --verbose'\n",
            f"{response.json()['message']} ({response.status_code})",
        )

    data = response.json()

    if json:
        print(data)
        return
    print(f"mission: {data['name']}")
    print(f"Creator: {data['creator']['name']}")
    print("Project: " + data["project"]["name"])
    table = Table("Filename", "Size", "date")

    if "files" not in data:
        print("No files found for mission.")
        return

    for file in data["files"]:
        table.add_row(file["filename"], f"{file['size']}", file["date"])
    console = Console()
    console.print(table)


@missionCommands.command("download")
def download(
    mission_uuid: Annotated[
        List[str], typer.Option(help="UUIDs of Mission to download")
    ],
    local_path: Annotated[str, typer.Option()],
    pattern: Optional[str] = typer.Option(
        None,
        help="Simple pattern to match the filename against. Allowed are alphanumeric characters,"
        " '_', '-', '.' and '*' as wildcard.",
    ),
):
    """

    Downloads all files of a mission to a local path.
    The local path must be an empty directory.

    """

    if not os.path.isdir(local_path):
        raise ValueError(f"Local path '{local_path}' is not a directory.")
    if not os.listdir(local_path) == []:

        full_local_path = os.path.abspath(local_path)

        raise ValueError(
            f"Local path '{full_local_path}' is not empty, it contains {len(os.listdir(local_path))} files. "
            f"The local target directory must be empty."
        )

    client = AuthenticatedClient()
    for single_mission_uuid in mission_uuid:
        response = client.get("/mission/download", params={"uuid": single_mission_uuid})
        try:
            response.raise_for_status()
        except httpx.HTTPError as e:
            raise AccessDeniedException(
                f"Failed to download file."
                f"Consider using the following command to list all missions: 'klein mission list --verbose'\n",
                f"{response.json()['message']} ({response.status_code})",
            )

        paths = response.json()
        if len(paths) == 0:
            continue

        # validate search pattern
        if pattern:
            if not re.match(r"^[a-zA-Z0-9_\-.*]+$", pattern):
                raise ValueError(
                    "Invalid pattern. Allowed are alphanumeric characters, '_', '-', '.' and '*' as wildcard."
                )

            regex = pattern.replace("*", ".*")
            pattern = re.compile(regex)

        print(f"Found {len(paths)} files in mission:")
        paths = [
            path for path in paths if not pattern or pattern.match(path["filename"])
        ]

        if pattern:
            print(
                f" » filtered to {len(paths)} files matching pattern '{pattern.pattern}'."
            )

        print(f"Start downloading {len(paths)} files to '{local_path}':\n")
        for path in paths:

            filename = path["filename"]

            response = requests.get(path["link"], stream=True)  # Enable streaming mode
            chunk_size = 1024 * 1024 * 10  # 10 MB chunks, adjust size if needed

            # Open the file for writing in binary mode
            with open(os.path.join(local_path, filename), "wb") as f:
                for chunk in tqdm(
                    response.iter_content(chunk_size=chunk_size),
                    unit="MB",
                    desc=filename,
                ):
                    if chunk:  # Filter out keep-alive new chunks
                        f.write(chunk)


@missionCommands.command("upload")
def upload(
    path: Annotated[
        List[str],
        typer.Option(prompt=True, help="Path to files to upload, Regex supported"),
    ],
    mission_uuid: Annotated[
        str, typer.Option(prompt=True, help="UUID of Mission to create")
    ],
):
    """
    Upload files matching the path to a mission in a project.

    The mission name must be unique within the project and already created.
    Multiple paths can be given by using the option multiple times.\n
    \n
    Examples:\n
        - 'klein upload --path "~/data/**/*.bag" --mission-uuid "2518cfc2-07f2-41a5-b74c-fdedb1b97f88" '\n

    """
    files = []
    for p in path:
        files.extend(expand_and_match(p))
    filenames = list(
        map(lambda x: x.split("/")[-1], filter(lambda x: not os.path.isdir(x), files))
    )
    if not filenames:
        raise ValueError("No files found matching the given path.")

    print(f"Uploading the following files to mission '{mission_uuid}':")
    filepaths = {}
    for path in files:
        if not os.path.isdir(path):
            filepaths[path.split("/")[-1]] = path
            typer.secho(f" - {path}", fg=typer.colors.RESET)

    try:
        client = AuthenticatedClient()
        get_temporary_credentials = "/file/temporaryAccess"
        response = client.post(
            get_temporary_credentials,
            json={"filenames": filenames, "missionUUID": mission_uuid},
        )
        if response.status_code >= 400:
            raise ValueError(
                "Failed to upload data. Status Code: "
                + str(response.status_code)
                + "\n"
                + response.json()["message"][0]
            )

        uploadFiles(response.json(), filepaths, 4)
    except Exception as e:
        print(e)
        print("Failed to upload files")
        raise e
