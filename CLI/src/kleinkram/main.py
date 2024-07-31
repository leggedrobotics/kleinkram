import sys
from datetime import datetime, timedelta
import os

import httpx
import typer
from typing import List, Optional
from typing_extensions import Annotated
from rich import print
from rich.table import Table

from .helper import uploadFiles, expand_and_match

from .auth import login, client, endpoint, setCliKey, setEndpoint

app = typer.Typer()
projects = typer.Typer(name="projects", help="Project operations")
missions = typer.Typer(name="missions", help="Mission operations")
files = typer.Typer(name="files", help="File operations")
topics = typer.Typer(name="topics", help="Topic operations")
queue = typer.Typer(name="queue", help="Status of files uploading")
user = typer.Typer(name="users", help="User operations")
tagtypes = typer.Typer(name="tagtypes", help="TagType operations")
tag = typer.Typer(name="tag", help="Tag operations")


app.add_typer(projects)
app.add_typer(missions)
app.add_typer(topics)
app.add_typer(files)
app.add_typer(queue)
app.add_typer(user)
app.add_typer(tagtypes)
app.add_typer(tag)
app.command()(login)
app.command()(endpoint)
app.command()(setEndpoint)
app.command(hidden=True)(setCliKey)


@files.command("list")
def list_files(
    project: Optional[str] = typer.Option(None, help="Name of Project"),
    mission: Optional[str] = typer.Option(None, help="Name of Mission"),
    topics: Optional[List[str]] = typer.Option(
        None, help="Comma separated list of topics"
    ),
):
    """
    List all files with optional filters for project, mission, or topics.

    Can list files of a project, mission, or with specific topics (Logical AND).
    Examples:\n
        - 'klein files list'\n
        - 'klein files list --project "Project 1"'\n
        - 'klein files list --mission "Mission 1"'\n
        - 'klein files list --topics "/elevation_mapping/semantic_map,/elevation_mapping/elevation_map_raw"'\n
        - 'klein files list --topics "/elevation_mapping/semantic_map,/elevation_mapping/elevation_map_raw" --mission "Mission A"'
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


@projects.command("list")
def list_projects():
    """
    List all projects.
    """
    try:
        response = client.get("/project")
        response.raise_for_status()
        projects = response.json()
        print("Projects:")
        for project in projects:
            print(f"- {project['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch projects: {e}")


@missions.command("list")
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


@missions.command("byUUID")
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
            print(table)
    except httpx.HTTPError as e:
        print(f"Failed to fetch missions: {e}")


@topics.command("list")
def topics(
    file: Annotated[str, typer.Option(help="Name of File")],
    full: Annotated[
        bool, typer.Option(help="As a table with additional parameters")
    ] = False,
    # Todo add mission / project as optional argument as filenames are not unique or handle multiple files
):
    """
    List topics for a file

    Only makes sense with MCAP files as we don't associate topics with BAGs.
    """
    if file.endswith(".bag"):
        print("BAG files generally do not have topics")
    try:
        url = "/file/byName"
        response = client.get(url, params={"name": file})
        response.raise_for_status()
        data = response.json()
        if not full:
            for topic in data["topics"]:
                print(f" - {topic['name']}")
        else:
            table = Table("UUID", "name", "type", "nrMessages", "frequency")
            for topic in data["topics"]:
                table.add_row(
                    topic["uuid"],
                    topic["name"],
                    topic["type"],
                    topic["nrMessages"],
                    f"{topic['frequency']}",
                )
            print(table)

    except httpx.HTTPError as e:
        print(f"Failed")


@projects.command("create")
def create_project(
    name: Annotated[str, typer.Option(help="Name of Project")],
    description: Annotated[str, typer.Option(help="Description of Project")],
):
    """
    Create a new project
    """
    try:
        url = "/project/create"
        response = client.post(
            url, json={"name": name, "description": description, "requiredTags": []}
        )  # TODO: Add required tags as option
        if response.status_code >= 400:
            response_json = response.json()
            response_text = response_json["message"]
            print(f"Failed to create project: {response_text}")
            return
        print("Project created")

    except httpx.HTTPError as e:
        print(f"Failed to create project: {e}")


@app.command("upload")
def upload(
    path: Annotated[
        str, typer.Option(prompt=True, help="Path to files to upload, Regex supported")
    ],
    project: Annotated[str, typer.Option(prompt=True, help="Name of Project")],
    mission: Annotated[
        str, typer.Option(prompt=True, help="Name of Mission to create")
    ],
):
    """
    Upload files matching the path to a mission in a project.

    The mission name must be unique within the project and not yet created.\n
    Examples:\n
        - 'klein upload --path "~/data/**/*.bag" --project "Project 1" --mission "Mission 1"'\n

    """
    files = expand_and_match(path)
    filenames = list(
        map(lambda x: x.split("/")[-1], filter(lambda x: not os.path.isdir(x), files))
    )
    if not filenames:
        print("No files found")
        return
    filepaths = {}
    for path in files:
        if not os.path.isdir(path):
            filepaths[path.split("/")[-1]] = path
            print(f"  - {path}")
    try:
        get_project_url = "/project/byName"
        project_response = client.get(get_project_url, params={"name": project})
        if project_response.status_code >= 400:
            print(f"Failed to fetch project: {project_response.text}")
            return
        project_json = project_response.json()
        if not project_json["uuid"]:
            print(f"Project not found: {project}")
            return

        get_mission_url = "/mission/byName"
        mission_response = client.get(get_mission_url, params={"name": mission})
        mission_response.raise_for_status()
        if mission_response.content:
            mission_json = mission_response.json()
            if mission_json["uuid"]:
                print(
                    f"mission: {mission_json['uuid']} already exists. Delete it or select another name."
                )
                return
            print(f"Something failed, should not happen")
            return

        create_mission_url = "/mission/create"
        new_mission = client.post(
            create_mission_url,
            json={"name": mission, "projectUUID": project_json["uuid"], "tags": []},
        )
        new_mission.raise_for_status()
        new_mission_data = new_mission.json()
        print(f"Created mission: {new_mission_data['name']}")

        get_presigned_url = "/queue/createPreSignedURLS"

        response_2 = client.post(
            get_presigned_url,
            json={"filenames": filenames, "missionUUID": new_mission_data["uuid"]},
        )
        response_2.raise_for_status()
        presigned_urls = response_2.json()
        for file in filenames:
            if not file in presigned_urls.keys():
                print("Could not upload File '" + file + "'. Is the filename unique? ")
        if len(presigned_urls) > 0:
            uploadFiles(presigned_urls, filepaths, 4)

    except httpx.HTTPError as e:
        print(e)


@queue.command("clear")
def clear_queue():
    """Clear queue"""
    # Prompt the user for confirmation
    confirmation = typer.prompt("Are you sure you want to clear the queue? (y/n)")
    if confirmation.lower() == "y":
        response = client.delete("/queue/clear")
        response.raise_for_status()
        print("Queue cleared.")
    else:
        print("Operation cancelled.")


@queue.command("list")
def list_queue():
    """List current Queue entities"""
    try:
        url = "/queue/active"
        startDate = datetime.now().date() - timedelta(days=1)
        response = client.get(url, params={"startDate": startDate})
        response.raise_for_status()
        data = response.json()
        table = Table("UUID", "filename", "mission", "state", "origin", "createdAt")
        for topic in data:
            table.add_row(
                topic["uuid"],
                topic["filename"],
                topic["mission"]["name"],
                topic["state"],
                topic["location"],
                topic["createdAt"],
            )
        print(table)

    except httpx.HTTPError as e:
        print(e)


@files.command("clear")
def clear_queue():
    """Clear queue"""
    # Prompt the user for confirmation
    confirmation = typer.prompt("Are you sure you want to clear the Files? (y/n)")
    if confirmation.lower() == "y":
        response = client.delete("/file/clear")
        response.raise_for_status()
        print("Files cleared.")
    else:
        print("Operation cancelled.")


@app.command("wipe", hidden=True)
def wipe():
    """Wipe all data"""
    # Prompt the user for confirmation
    confirmation = typer.prompt("Are you sure you want to wipe all data? (y/n)")
    if confirmation.lower() == "y":
        second_confirmation = typer.prompt(
            "This action is irreversible. Are you really sure? (y/n)"
        )
        if second_confirmation.lower() != "y":
            print("Operation cancelled.")
            return

        response_queue = client.delete("/queue/clear")
        response_file = client.delete("/file/clear")
        response_analysis = client.delete("/analysis/clear")
        response_mission = client.delete("/mission/clear")
        response_project = client.delete("/project/clear")

        if response_queue.status_code >= 400:
            print("Failed to clear queue.")
            print(response_queue.text)
        elif response_file.status_code >= 400:
            print("Failed to clear files.")
            print(response_file.text)
        elif response_analysis.status_code >= 400:
            print("Failed to clear analysis.")
            print(response_analysis.text)
        elif response_mission.status_code >= 400:
            print("Failed to clear missions.")
            print(response_mission.text)
        elif response_project.status_code >= 400:
            print("Failed to clear projects.")
            print(response_project.text)
        else:
            print("Data wiped.")
    else:
        print("Operation cancelled.")


@app.command("claim", hidden=True)
def claim():
    """
    Claim admin rights as the first user

    Only works if no other user has claimed admin rights before.
    """
    response = client.post("/user/claimAdmin")
    response.raise_for_status()
    print("Admin claimed.")


@user.command("list")
def users():
    """List all users"""
    response = client.get("/user/all")
    response.raise_for_status()
    data = response.json()
    table = Table("Name", "Email", "Role", "googleId")
    for user in data:
        table.add_row(user["name"], user["email"], user["role"], user["googleId"])
    print(table)


@user.command("info")
def user_info():
    """Get logged in user info"""
    response = client.get("/user/me")
    response.raise_for_status()
    data = response.json()
    print(data)


@user.command("promote")
def promote(email: Annotated[str, typer.Option()]):
    """Promote another user to admin"""
    response = client.post("/user/promote", json={"email": email})
    response.raise_for_status()
    print("User promoted.")


@user.command("demote")
def demote(email: Annotated[str, typer.Option()]):
    """Demote another user from admin"""
    response = client.post("/user/demote", json={"email": email})
    response.raise_for_status()
    print("User demoted.")


@files.command("download")
def download(
    missionuuid: Annotated[str, typer.Argument()],
):
    """Download file"""
    try:
        response = client.get("/file/downloadWithToken", params={"uuid": missionuuid})
        response.raise_for_status()
        print(response.json())
    except:
        print("Failed to download file")


@missions.command("tag")
def addTag(
    missionuuid: Annotated[str, typer.Argument()],
    tagtypeuuid: Annotated[str, typer.Argument()],
    value: Annotated[str, typer.Argument()],
):
    """Tag a mission"""
    try:
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


@tagtypes.command("list")
def tagTypes(
    verbose: Annotated[bool, typer.Option()] = False,
):
    """List all tagtypes"""
    try:
        response = client.get("/tag/all")
        response.raise_for_status()
        data = response.json()
        if verbose:
            table = Table("UUID", "Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["uuid"], tagtype["name"], tagtype["datatype"])
        else:
            table = Table("Name", "Datatype")
            for tagtype in data:
                table.add_row(tagtype["name"], tagtype["datatype"])
        print(table)
    except:
        print("Failed to fetch tagtypes")


@tag.command("delete")
def deleteTag(
    taguuid: Annotated[str, typer.Argument()],
):
    """Delete a tag"""
    try:
        response = client.delete("/tag/deleteTag", params={"uuid": taguuid})
        if response.status_code < 400:
            print("Deleted tag")
        else:
            print(response)
            print("Failed to delete tag")
    except:
        print("Failed to delete tag")


if __name__ == "__main__":
    app()
