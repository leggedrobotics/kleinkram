import httpx
import typer
from rich.console import Console
from rich.table import Table
from typing_extensions import Annotated

from kleinkram.api_client import AuthenticatedClient

project = typer.Typer(
    name="project",
    help="Project operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@project.command("list", help="List all projects")
def list_projects():
    """
    List all projects.
    """
    client = AuthenticatedClient()
    response = client.get("/project/filtered")
    response.raise_for_status()
    projects = response.json()[0]

    if len(projects) == 0:
        print("No projects found. Create a new project using 'klein project create'")
        return

    stdout_console = Console(stderr=False)
    stderr_console = Console(stderr=True)
    stderr_console.print(f"\nfound {len(projects)} projects with the following UUIDs:")

    # print the uuids to stdout for simple piping
    for p in projects:
        stderr_console.print(" - ", end="")
        stdout_console.print(p["uuid"])
    stderr_console.print("\n")

    # Print a summary table using rich to stderr
    table = Table(title="Projects", expand=True)
    table.add_column("Project UUID", width=10)
    table.add_column("Project Name", width=12)
    table.add_column("Description")
    for p in projects:
        table.add_row(p["uuid"], p["name"], p["description"])

    stderr_console.print(table)
    stderr_console.print("\n")


@project.command("details", help="Get details of a project", no_args_is_help=True)
def project_details(
    project_uuid: Annotated[
        str, typer.Argument(help="UUID of the project to get details of")
    ]
):
    """
    Get details of a project
    """
    client = AuthenticatedClient()
    response = client.get(f"/project/one?uuid={project_uuid}")
    response.raise_for_status()
    project = response.json()

    stdout_console = Console(stderr=False)
    stderr_console = Console(stderr=True)
    stderr_console.print(
        f"\nDetails of project with UUID {project_uuid}:", highlight=False
    )

    # Print the details to stderr using rich
    table = Table(title="Project Details", expand=True)
    table.add_column("Key", width=16)
    table.add_column("Value")
    for key, value in project.items():

        access_name_map = {0: "READ", 10: "CREATE", 20: "WRITE", 30: "DELETE"}

        if key == "project_accesses":
            value = ", ".join(
                [
                    f"'{access['accessGroup']['name']}' ({access_name_map[access['rights']]})"
                    for access in value
                ]
            )

        if key == "missions":
            value = ", ".join([f"'{mission['name']}'" for mission in value])

        if key == "creator":
            value = value["name"]

        table.add_row(key, f"{value}")

    stderr_console.print(table)
    stderr_console.print("\nList of missions:")
    for mission in project["missions"]:
        stderr_console.print(" - ", end="")
        stdout_console.print(mission["uuid"])


@project.command("create", no_args_is_help=True, help="Create a new project")
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
            raise ValueError(f"Failed to create project\n » {response_text}!")

        stderr_console = Console(stderr=True)
        stderr_console.print(f"Project '{name}' created successfully.")

        stdout_console = Console(stderr=False)
        stderr_console.print("\nProject UUID:\n - ", end="")
        stdout_console.print(response.json()["uuid"])

    except httpx.HTTPError as e:
        print(f"Failed to create project: {e}")
        raise e


@project.command("delete", help="Delete a project")
def delete_project():
    raise NotImplementedError()
