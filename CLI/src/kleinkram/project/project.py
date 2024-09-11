from typing_extensions import Annotated

import httpx
import typer

from kleinkram.api_client import AuthenticatedClient

project = typer.Typer(
    name="project",
    help="Project operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@project.command("list")
def list_projects():
    """
    List all projects.
    """
    try:
        client = AuthenticatedClient()
        response = client.get("/project/filtered")
        response.raise_for_status()
        projects = response.json()[0]
        print("Projects:")
        for _project in projects:
            print(f"- {_project['name']}")

    except httpx.HTTPError as e:
        print(f"Failed to fetch projects: {e}")


@project.command("create")
def create_project(
    name: Annotated[str, typer.Option(help="Name of Project")],
    description: Annotated[str, typer.Option(help="Description of Project")],
):
    """
    Create a new project
    """
    # Todo add required tags as option.
    try:
        url = "/project/create"
        client = AuthenticatedClient()
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
        raise e
