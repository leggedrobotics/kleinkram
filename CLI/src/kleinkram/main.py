import os
from datetime import datetime, timedelta
from enum import Enum

import httpx
import typer
from rich import print
from rich.table import Table
from typer.core import TyperGroup
from typer.models import Context
from typing_extensions import Annotated

from kleinkram.api_client import AuthenticatedClient
from kleinkram.auth.auth import login, endpoint, setEndpoint, setCliKey, logout
from kleinkram.file.file import file
from kleinkram.mission.mission import mission
from kleinkram.project.project import project
from kleinkram.queue.queue import queue
from kleinkram.tag.tag import tag
from kleinkram.topic.topic import topic
from kleinkram.user.user import user
from .helper import uploadFiles, expand_and_match


class Panel(str, Enum):
    CoreCommands = "CORE COMMANDS"
    Commands = "COMMANDS"
    AdditionalCommands = "ADDITIONAL COMMANDS"


class OrderCommands(TyperGroup):
    """

    The following code snippet is taken from https://github.com/tiangolo/typer/discussions/855 (see comment
    https://github.com/tiangolo/typer/discussions/855#discussioncomment-9824582) and adapted to our use case.
    """

    def list_commands(self, _ctx: Context) -> list[str]:
        order = list(Panel)
        grouped_commands = {
            name: getattr(command, "rich_help_panel")
            for name, command in sorted(self.commands.items())
            if getattr(command, "rich_help_panel") in order
        }
        ungrouped_command_names = [
            command.name
            for command in self.commands.values()
            if command.name not in grouped_commands
        ]
        return [
            name
            for name, command in sorted(
                grouped_commands.items(),
                key=lambda item: order.index(item[1]),
            )
        ] + sorted(ungrouped_command_names)


app = typer.Typer(
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
    cls=OrderCommands,
)

app.add_typer(project, rich_help_panel=Panel.Commands)
app.add_typer(mission, rich_help_panel=Panel.Commands)

app.add_typer(topic, rich_help_panel=Panel.Commands)
app.add_typer(file, rich_help_panel=Panel.Commands)
app.add_typer(queue, rich_help_panel=Panel.Commands)
app.add_typer(user, rich_help_panel=Panel.Commands)
app.add_typer(tag, rich_help_panel=Panel.Commands)

app.command(rich_help_panel=Panel.CoreCommands)(login)
app.command(rich_help_panel=Panel.CoreCommands)(logout)
app.command(rich_help_panel=Panel.AdditionalCommands)(endpoint)
app.command(rich_help_panel=Panel.AdditionalCommands)(setEndpoint)
app.command(hidden=True)(setCliKey)


@app.command("download", rich_help_panel=Panel.CoreCommands)
def download():
    raise NotImplementedError("Not implemented yet.")


@app.command("upload", rich_help_panel=Panel.CoreCommands)
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
        client = AuthenticatedClient()

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
        client = AuthenticatedClient()
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
        client = AuthenticatedClient()
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

        client = AuthenticatedClient()
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

    client = AuthenticatedClient()
    response = client.post("/user/claimAdmin")
    response.raise_for_status()
    print("Admin claimed.")


if __name__ == "__main__":
    app()
