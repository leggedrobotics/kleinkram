import os
from datetime import datetime, timedelta
from enum import Enum

import httpx
import importlib.metadata
import typer
from rich import print
from rich.table import Table
from typer.core import TyperGroup
from typer.models import Context
from typing_extensions import Annotated, List, Optional

from kleinkram.api_client import AuthenticatedClient
from kleinkram.auth.auth import login, setCliKey, logout
from kleinkram.endpoint.endpoint import endpoint
from kleinkram.error_handling import ErrorHandledTyper, AccessDeniedException
from kleinkram.file.file import file
from kleinkram.mission.mission import missionCommands
from kleinkram.project.project import project
from kleinkram.queue.queue import queue
from kleinkram.tag.tag import tag
from kleinkram.topic.topic import topic
from kleinkram.user.user import user
from .helper import uploadFiles, expand_and_match, canUploadMission, promptForTags


class CommandPanel(str, Enum):
    CoreCommands = "CORE COMMANDS"
    Commands = "COMMANDS"
    AdditionalCommands = "ADDITIONAL COMMANDS"


def version_callback(value: bool):
    if value:
        try:
            _version = importlib.metadata.version("kleinkram")
        except importlib.metadata.PackageNotFoundError:
            _version = "local"
        typer.echo(f"CLI Version: {_version}")
        raise typer.Exit()


class OrderCommands(TyperGroup):
    """

    The following code snippet is taken from https://github.com/tiangolo/typer/discussions/855 (see comment
    https://github.com/tiangolo/typer/discussions/855#discussioncomment-9824582) and adapted to our use case.
    """

    def list_commands(self, _ctx: Context) -> List[str]:
        order = list(CommandPanel)
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


app = ErrorHandledTyper(
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
    cls=OrderCommands,
)


@app.callback()
def version(
    version: bool = typer.Option(
        None,
        "--version",
        "-v",
        callback=version_callback,
        is_eager=True,
        help="Print the version and exit",
    )
):
    pass


app.add_typer(project, rich_help_panel=CommandPanel.Commands)
app.add_typer(missionCommands, rich_help_panel=CommandPanel.Commands)

app.add_typer(topic, rich_help_panel=CommandPanel.Commands)
app.add_typer(file, rich_help_panel=CommandPanel.Commands)
app.add_typer(queue, rich_help_panel=CommandPanel.Commands)
app.add_typer(user, rich_help_panel=CommandPanel.Commands)
app.add_typer(tag, rich_help_panel=CommandPanel.Commands)
app.add_typer(endpoint, rich_help_panel=CommandPanel.AdditionalCommands)

app.command(rich_help_panel=CommandPanel.AdditionalCommands)(login)
app.command(rich_help_panel=CommandPanel.AdditionalCommands)(logout)
app.command(hidden=True)(setCliKey)


@app.command("download", rich_help_panel=CommandPanel.CoreCommands)
def download():
    raise NotImplementedError("Not implemented yet.")


@app.command("upload", rich_help_panel=CommandPanel.CoreCommands)
def upload(
    path: Annotated[
        List[str],
        typer.Option(prompt=True, help="Path to files to upload, Regex supported"),
    ],
    project: Annotated[str, typer.Option(prompt=True, help="Name of Project")],
    mission: Annotated[
        str, typer.Option(prompt=True, help="Name of Mission to create")
    ],
    tags: Annotated[
        Optional[List[str]],
        typer.Option(prompt=False, help="Tags to add to the mission"),
    ] = None,
):
    """
    Upload files matching the path to a mission in a project.

    The mission name must be unique within the project and not yet created.\n
    Multiple paths can be given by using the option multiple times.\n
    Examples:\n
        - 'klein upload --path "~/data/**/*.bag" --project "Project 1" --mission "Mission 1" --tags "0700946d-1d6a-4520-b263-0e177f49c35b:LEE-H" --tags "1565118d-593c-4517-8c2d-9658452d9319:Dodo"'\n

    """
    files = []
    for p in path:
        files.extend(expand_and_match(p))
    filenames = list(
        map(lambda x: x.split("/")[-1], filter(lambda x: not os.path.isdir(x), files))
    )
    if not filenames:
        raise ValueError("No files found matching the given path.")

    print(
        f"Uploading the following files to mission '{mission}' in project '{project}':"
    )
    filepaths = {}
    for path in files:
        if not os.path.isdir(path):
            filepaths[path.split("/")[-1]] = path
            typer.secho(f" - {path}", fg=typer.colors.RESET)

    try:
        client = AuthenticatedClient()

        get_project_url = "/project/byName"
        project_response = client.get(get_project_url, params={"name": project})
        if project_response.status_code >= 400:
            raise AccessDeniedException(
                f"The project '{project}' does not exist or you do not have access to it.\n"
                f"Consider using the following command to create a project: 'klein project create'\n",
                f"{project_response.json()['message']} ({project_response.status_code})",
            )

        project_json = project_response.json()
        if not project_json["uuid"]:
            print(f"Project not found: '{project}'")
            return

        can_upload = canUploadMission(client, project_json["uuid"])
        if not can_upload:
            raise AccessDeniedException(
                f"You do not have the required permissions to upload to project '{project}'\n",
                "Access Denied",
            )

        if not tags:
            tags = []
        tags_dict = {item.split(":")[0]: item.split(":")[1] for item in tags}

        promptForTags(tags_dict, project_json["requiredTags"])

        get_mission_url = "/mission/byName"
        mission_response = client.get(get_mission_url, params={"name": mission})
        mission_response.raise_for_status()
        if mission_response.content:
            mission_json = mission_response.json()
            if mission_json["uuid"]:
                raise ValueError(
                    f"Mission {mission_json['name']} ({mission_json['uuid']}) already exists. Delete it or select "
                    f"another name."
                )
            raise Exception(f"Something failed, should not happen")

        create_mission_url = "/mission/create"
        new_mission = client.post(
            create_mission_url,
            json={
                "name": mission,
                "projectUUID": project_json["uuid"],
                "tags": tags_dict,
            },
        )
        if new_mission.status_code >= 400:
            raise ValueError(
                "Failed to create mission. Status Code: "
                + str(new_mission.status_code)
                + "\n"
                + new_mission.json()["message"]
            )
        new_mission_data = new_mission.json()

        get_temporary_credentials = "/file/temporaryAccess"
        response_2 = client.post(
            get_temporary_credentials,
            json={"filenames": filenames, "missionUUID": new_mission_data["uuid"]},
        )
        if response_2.status_code >= 400:
            raise ValueError(
                "Failed to get temporary credentials. Status Code: "
                + str(response_2.status_code)
                + "\n"
                + response_2.json()["message"]
            )
        temp_credentials = response_2.json()
        credential = temp_credentials["credentials"]
        confirmed_files = temp_credentials["files"]
        for _file in filenames:
            if not _file in confirmed_files.keys():
                raise Exception(
                    "Could not upload File '" + _file + "'. Is the filename unique? "
                )
            confirmed_files[_file]["filepath"] = filepaths[_file]
        if len(confirmed_files.keys()) > 0:
            uploadFiles(confirmed_files, credential, 4)

    except httpx.HTTPError as e:
        print(e)


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
