import typer
import httpx
from typing import List, Optional
from typing_extensions import Annotated

app = typer.Typer()
projects = typer.Typer(name="projects")
runs = typer.Typer(name="runs")
files = typer.Typer(name="files")

app.add_typer(projects)
app.add_typer(runs)
app.add_typer(files)
API_URL = 'http://localhost:3000'

@files.command('list')
def list_files(project: Annotated[str, typer.Option()],
               run: Annotated[str, typer.Option()],
               topics: Annotated[List[str], typer.Option()]):
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

        typer.echo('Files by Run & Project:')
        for project_uuid, runs in runs_by_project_uuid.items():
            first_file = files_by_run_uuid[runs[0]][0]
            typer.echo(f"* {first_file['run']['project']['name']}")
            for run in runs:
                typer.echo(f"  - {files_by_run_uuid[run][0]['run']['name']}")
                for file in files_by_run_uuid[run]:
                    typer.echo(f"    - {file['filename']}")

    except httpx.HTTPError as e:
        typer.echo(f"Failed to fetch runs: {e}")

@projects.command('list')
def list_projects():
    """
    List all projects.
    """
    try:
        response = httpx.get(f"{API_URL}/project")
        response.raise_for_status()
        projects = response.json()
        typer.echo('Projects:')
        for project in projects:
            typer.echo(f"- {project['name']}")

    except httpx.HTTPError as e:
        typer.echo(f"Failed to fetch projects: {e}")


@runs.command('list')
def list_runs(project: Annotated[str, typer.Option()]=None):
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

        typer.echo('Runs by Project:')
        for project_uuid, runs in runs_by_project_uuid.items():
            typer.echo(f"* {runs_by_project_uuid[project_uuid][0]['project']['name']}")
            for run in runs:
                typer.echo(f"  - {run['name']}")

    except httpx.HTTPError as e:
        typer.echo(f"Failed to fetch runs: {e}")

if __name__ == "__main__":
    app()
