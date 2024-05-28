import os

import httpx
import typer
from typing import List, Optional
from typing_extensions import Annotated
from rich import print
from rich.table import Table


from .consts import API_URL
from .helper import uploadFiles, expand_and_match

from .auth import login, client

app = typer.Typer()
projects = typer.Typer(name="projects")
runs = typer.Typer(name="runs")
files = typer.Typer(name="files")
topics = typer.Typer(name="topics")
queue = typer.Typer(name="queue")
user = typer.Typer(name="user")

app.add_typer(projects)
app.add_typer(runs)
app.add_typer(topics)
app.add_typer(files)
app.add_typer(queue)
app.add_typer(user)
app.command()(login)


@files.command("list")
def list_files(
    project: Annotated[str, typer.Option()] = None,
    run: Annotated[str, typer.Option()] = None,
    topics: Annotated[List[str], typer.Option()] = None,
):
    """
    List all files with optional filters for project, run, or topics.
    """
    try:
        url = f"{API_URL}/file/filteredByNames"
        response = client.get(
            url,
            params={
                "projectName": project,
                "runName": run,
                "topics": topics,
            },
        )
        response.raise_for_status()
        data = response.json()
        runs_by_project_uuid = {}
        files_by_run_uuid = {}
        for file in data:
            run_uuid = file["run"]["uuid"]
            project_uuid = file["run"]["project"]["uuid"]
            if project_uuid not in runs_by_project_uuid:
                runs_by_project_uuid[project_uuid] = []
            if run_uuid not in runs_by_project_uuid[project_uuid]:
                runs_by_project_uuid[project_uuid].append(run_uuid)
            if run_uuid not in files_by_run_uuid:
                files_by_run_uuid[run_uuid] = []
            files_by_run_uuid[run_uuid].append(file)

        print("Files by Run & Project:")
        for project_uuid, runs in runs_by_project_uuid.items():
            first_file = files_by_run_uuid[runs[0]][0]
            print(f"* {first_file['run']['project']['name']}")
            for run in runs:
                print(f"  - {files_by_run_uuid[run][0]['run']['name']}")
                for file in files_by_run_uuid[run]:
                    print(f"    - '{file['filename']}'")

    except httpx.HTTPError as e:
        print(f"Failed to fetch runs: {e}")


@projects.command("list")
def list_projects():
    """
    List all projects.
    """
    try:
        response = client.get(f"{API_URL}/project")
        response.raise_for_status()
        projects = response.json()
        print("Projects:")
        for project in projects:
            print(f"- {project['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch projects: {e}")


@runs.command("list")
def list_runs(
    project: Annotated[str, typer.Option()] = None,
):
    """
    List all runs with optional filter for project.
    """
    try:
        url = f"{API_URL}/run"
        if project:
            url += f"/filteredByProjectName/{project}"
        else:
            url += "/all"
        response = client.get(url)
        response.raise_for_status()
        data = response.json()
        runs_by_project_uuid = {}
        for run in data:
            project_uuid = run["project"]["uuid"]
            if project_uuid not in runs_by_project_uuid:
                runs_by_project_uuid[project_uuid] = []
            runs_by_project_uuid[project_uuid].append(run)

        print("Runs by Project:")
        for project_uuid, runs in runs_by_project_uuid.items():
            print(f"* {runs_by_project_uuid[project_uuid][0]['project']['name']}")
            for run in runs:
                print(f"  - {run['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch runs: {e}")

@runs.command("byUUID")
def run_by_uuid(
    uuid: Annotated[str, typer.Argument()],
):
    try:
        url = f"{API_URL}/run/byUUID"
        response = client.get(url, params={"uuid": uuid})
        response.raise_for_status()
        data = response.json()
        print(f"Run: {data['name']}")
        print(f"Creator: {data['creator']['name']}")
        table = Table("Filename", "Size", "date")
        for file in data["files"]:
            table.add_row(file["filename"], f"{file['size']}", file["date"])
    except httpx.HTTPError as e:
        print(f"Failed to fetch runs: {e}")

@topics.command("list")
def topics(
    file: Annotated[str, typer.Option()] = None,
    full: Annotated[bool, typer.Option()] = False,
):
    try:
        url = API_URL + "/file/byName"
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
def create_project(name: Annotated[str, typer.Option()]):
    try:
        url = API_URL + "/project/create"
        response = client.post(url, json={"name": name})
        response.raise_for_status()
        print("Project created")

    except httpx.HTTPError as e:
        print(f"Failed to create project: {e}")


@app.command("upload")
def upload(
    path: Annotated[str, typer.Option(prompt=True)],
    project: Annotated[str, typer.Option(prompt=True)],
    run: Annotated[str, typer.Option(prompt=True)],
):
    files = expand_and_match(path)
    filenames = list(map(lambda x: x.split("/")[-1], files))
    filepaths = {}
    for path in files:
        if not os.path.isdir(path):
            filepaths[path.split("/")[-1]] = path
            print(f"  - {path}")
    try:
        get_project_url = API_URL + "/project/byName"
        project_response = client.get(get_project_url, params={"name": project})
        project_response.raise_for_status()

        project_json = project_response.json()
        if not project_json["uuid"]:
            print(f"Project not found: {project}")
            return

        get_run_url = API_URL + "/run/byName"
        run_response = client.get(get_run_url, params={"name": run})
        run_response.raise_for_status()
        if run_response.content:
            run_json = run_response.json()
            if run_json["uuid"]:
                print(
                    f"Run: {run_json['uuid']} already exists. Delete it or select another name."
                )
                return
            print(f"Something failed, should not happen")
            return

        create_run_url = API_URL + "/run/create"
        new_run = client.post(
            create_run_url, json={"name": run, "projectUUID": project_json["uuid"]}
        )
        new_run.raise_for_status()
        new_run_data = new_run.json()
        print(f"Created run: {new_run_data['name']}")

        get_presigned_url = API_URL + "/queue/createPreSignedURLS"
        response_2 = client.post(
            get_presigned_url,
            json={"filenames": filenames, "runUUID": new_run_data["uuid"]},
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
        response = client.delete(f"{API_URL}/queue/clear")
        response.raise_for_status()
        print("Queue cleared.")
    else:
        print("Operation cancelled.")


@files.command("clear")
def clear_queue():
    """Clear queue"""
    # Prompt the user for confirmation
    confirmation = typer.prompt("Are you sure you want to clear the Files? (y/n)")
    if confirmation.lower() == "y":
        response = client.delete(f"{API_URL}/file/clear")
        response.raise_for_status()
        print("Files cleared.")
    else:
        print("Operation cancelled.")


@app.command("wipe")
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

        response_queue = client.delete(f"{API_URL}/queue/clear")
        response_file = client.delete(f"{API_URL}/file/clear")
        response_run = client.delete(f"{API_URL}/run/clear")
        response_project = client.delete(f"{API_URL}/project/clear")

        if response_queue.status_code >= 400:
            print("Failed to clear queue.")
            print(response_queue.text)
        elif response_file.status_code >= 400:
            print("Failed to clear files.")
            print(response_file.text)
        elif response_run.status_code >= 400:
            print("Failed to clear runs.")
            print(response_run.text)
        elif response_project.status_code >= 400:
            print("Failed to clear projects.")
            print(response_project.text)
        else:
            print("Data wiped.")
    else:
        print("Operation cancelled.")


@app.command("claim")
def claim():
    response = client.post(f"{API_URL}/user/claimAdmin")
    response.raise_for_status()
    print("Admin claimed.")


@user.command("list")
def users():
    response = client.get(f"{API_URL}/user/all")
    response.raise_for_status()
    data = response.json()
    table = Table("Name", "Email", "Role", "googleId")
    for user in data:
        table.add_row(user["name"], user["email"], user["role"], user["googleId"])
    print(table)


@user.command("info")
def user_info():
    response = client.get(f"{API_URL}/user/me")
    response.raise_for_status()
    data = response.json()
    print(data)


@user.command("promote")
def promote(email: Annotated[str, typer.Option()]):
    response = client.post(f"{API_URL}/user/promote", json={"email": email})
    response.raise_for_status()
    print("User promoted.")


@user.command("demote")
def demote(email: Annotated[str, typer.Option()]):
    response = client.post(f"{API_URL}/user/demote", json={"email": email})
    response.raise_for_status()
    print("User demoted.")


@files.command("download")
def download(
        runuuid: Annotated[str, typer.Argument()],
):
    try:
        response = client.get(f"{API_URL}/file/downloadWithToken", params={"uuid": runuuid})
        response.raise_for_status()
        print(response.json())
    except:
        print("Failed to download file")

if __name__ == "__main__":
    app()
