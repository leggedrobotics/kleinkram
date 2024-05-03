import os

import typer
import httpx
from typing import List, Optional
from typing_extensions import Annotated
from rich import print
from rich.table import Table

from consts import API_URL
from helper import list_files_recursive, printFiles, convertFilesStructure, uploadFiles

app = typer.Typer()
projects = typer.Typer(name="projects")
runs = typer.Typer(name="runs")
files = typer.Typer(name="files")
topics = typer.Typer(name="topics")

app.add_typer(projects)
app.add_typer(runs)
app.add_typer(topics)
app.add_typer(files)

@files.command('list')
def list_files(project: Annotated[str, typer.Option()] = None,
               run: Annotated[str, typer.Option()] = None,
               topics: Annotated[List[str], typer.Option()] = None):
    """
    List all files with optional filters for project, run, or topics.
    """
    try:
        url = f"{API_URL}/file/filteredByNames"
        response = httpx.get(url, params={
            'projectName': project,
            'runName': run,
            'topics': topics,
        })
        response.raise_for_status()
        data = response.json()
        runs_by_project_uuid = {}
        files_by_run_uuid = {}
        for file in data:
            run_uuid = file['run']['uuid']
            project_uuid = file['run']['project']['uuid']
            if project_uuid not in runs_by_project_uuid:
                runs_by_project_uuid[project_uuid] = []
            if run_uuid not in runs_by_project_uuid[project_uuid]:
                runs_by_project_uuid[project_uuid].append(run_uuid)
            if run_uuid not in files_by_run_uuid:
                files_by_run_uuid[run_uuid] = []
            files_by_run_uuid[run_uuid].append(file)

        print('Files by Run & Project:')
        for project_uuid, runs in runs_by_project_uuid.items():
            first_file = files_by_run_uuid[runs[0]][0]
            print(f"* {first_file['run']['project']['name']}")
            for run in runs:
                print(f"  - {files_by_run_uuid[run][0]['run']['name']}")
                for file in files_by_run_uuid[run]:
                    print(f"    - {file['filename']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch runs: {e}")

@projects.command('list')
def list_projects():
    """
    List all projects.
    """
    try:
        response = httpx.get(f"{API_URL}/project")
        response.raise_for_status()
        projects = response.json()
        print('Projects:')
        for project in projects:
            print(f"- {project['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch projects: {e}")


@runs.command('list')
def list_runs(project: Annotated[str, typer.Option()]=None,):
    """
    List all runs with optional filter for project.
    """
    try:
        url = f"{API_URL}/run"
        if project:
            url += f"/filteredByProjectName/{project}"
        else:
            url += "/all"
        response = httpx.get(url)
        response.raise_for_status()
        data = response.json()
        runs_by_project_uuid = {}
        for run in data:
            project_uuid = run['project']['uuid']
            if project_uuid not in runs_by_project_uuid:
                runs_by_project_uuid[project_uuid] = []
            runs_by_project_uuid[project_uuid].append(run)

        print('Runs by Project:')
        for project_uuid, runs in runs_by_project_uuid.items():
            print(f"* {runs_by_project_uuid[project_uuid][0]['project']['name']}")
            for run in runs:
                print(f"  - {run['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch runs: {e}")

@topics.command("list")
def topics(file: Annotated[str, typer.Option()] = None, full: Annotated[bool, typer.Option()] = False):
    try:
        url = API_URL + "/file/byName"
        response = httpx.get(url, params={"name": file})
        response.raise_for_status()
        data = response.json()
        if not full:
            for topic in data["topics"]:
                print(f" - {topic['name']}")
        else:
            table = Table("UUID", "name", "type", "nrMessages", "frequency")
            for topic in data["topics"]:
                table.add_row(topic["uuid"], topic["name"], topic["type"], topic["nrMessages"], f"{topic["frequency"]}")
            print(table)

    except httpx.HTTPError as e:
        print(f"Failed")

@files.command("upload")
def upload(path: Annotated[str, typer],
           run: Annotated[str, typer.Option()],
           pattern: Annotated[str, typer.Option()]="*",
           r: Annotated[bool, typer.Option()]=False):
    path = os.path.expanduser(path)
    if os.path.isdir(path):
        files = list_files_recursive(path, r, pattern)
    else:
        files = {"": [path.split("/")[-1]]}
        path = "/".join(path.split("/")[:-1])
    printFiles(files)
    convertedFiles = convertFilesStructure(files, path + "/")
    filenames = list(map(lambda x: x.split("/")[-1], convertedFiles))
    filepaths = {}
    for path in convertedFiles:
        filepaths[path.split("/")[-1]] = path
    try:
        get_run_url = API_URL + "/run/byName"

        response_1 = httpx.get(get_run_url, params={"name": run})
        response_1.raise_for_status()
        data = response_1.json()
        get_presigned_url = API_URL + "/queue/createPreSignedURLS"
        print(filenames)
        response_2 = httpx.post(get_presigned_url, json={"filenames": filenames, "runUUID": data["uuid"]})
        response_2.raise_for_status()
        presigned_urls = response_2.json()
        uploadFiles(presigned_urls, filepaths, 4)



    except httpx.HTTPError as e:
        print(e)

if __name__ == "__main__":
    app()
