import importlib.metadata
import os
from datetime import datetime, timedelta
from enum import Enum

import httpx
import typer
from rich import print
from rich.table import Table
from typer.core import TyperGroup
from typer.models import Context
from typing_extensions import Annotated, List, Optional

from kleinkram.api_client import AuthenticatedClient
from kleinkram.auth.auth import login, setCliKey, logout
from kleinkram.endpoint.endpoint import endpoint
from kleinkram.error_handling import (
    ErrorHandledTyper,
    AccessDeniedException,
)
from kleinkram.file.file import file
from kleinkram.mission.mission import missionCommands
from kleinkram.project.project import project
from kleinkram.queue.queue import queue
from kleinkram.tag.tag import tag
from kleinkram.topic.topic import topic
from kleinkram.user.user import user
from .helper import (
    is_valid_UUIDv4,
    canUploadMission,
    promptForTags,
    expand_and_match,
    uploadFiles,
)


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
    help=f"Kleinkram CLI\n\nThe Kleinkram CLI is a command line interface for Kleinkram. "
    f"For a list of available commands, run 'klein --help' or visit "
    f"https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html for more information.",
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
    print(
        "Not implemented yet. Consider using the 'klein file download' or 'klein mission download' commands."
    )


@app.command("upload", rich_help_panel=CommandPanel.CoreCommands, no_args_is_help=True)
def upload(
    path: Annotated[
        List[str],
        typer.Option(help="Path to files to upload, Regex supported"),
    ],
    project: Annotated[str, typer.Option(help="Name or UUID of a Project")],
    mission: Annotated[str, typer.Option(help="Name of UUID Mission to create")],
    tags: Annotated[
        Optional[List[str]],
        typer.Option(help="Tags to add to the mission"),
    ] = None,
    fix_filenames: Annotated[
        bool,
        typer.Option(help="Automatically fix filenames such that they are valid"),
    ] = False,
    create_project: Annotated[
        bool,
        typer.Option(help="Allows adding files to an existing mission"),
    ] = False,
    create_mission: Annotated[
        bool,
        typer.Option(help="Allows adding files to an existing mission"),
    ] = False,
    overwrite: Annotated[
        bool,
        typer.Option(
            help="Overwrite files with the same name.\n\n*WARNING:* This cannot be undone! This command will NOT delete"
            "converted files, i.g. if the file is of type 'some-name.bag' the converted 'some-name.mcap' file will not "
            "be deleted."
        ),
    ] = False,
    overwrite_all: Annotated[
        bool,
        typer.Option(
            help="Overwrite files with the same name.\n\n*WARNING:* This cannot be undone! This command WILL "
            "automatically delete converted files, i.g. if the file is of type 'some-name.bag' the converted "
            "'some-name.mcap' file will be deleted."
        ),
    ] = False,
):
    """
    Upload files matching the path to a mission in a project.

    The mission name must be unique within the project and not yet created.\n
    Multiple paths can be given by using the option multiple times.\n
    Examples:\n
        - 'klein upload --path "~/data/**/*.bag" --project "Project_1" --mission "Mission_1" --tags "0700946d-1d6a-4520-b263-0e177f49c35b:LEE-H" --tags "1565118d-593c-4517-8c2d-9658452d9319:Dodo"'\n

    """

    client = AuthenticatedClient()

    ##############################
    # Check if project exists
    ##############################
    if is_valid_UUIDv4(project):
        get_project_url = "/project/one"
        project_response = client.get(get_project_url, params={"uuid": project})
    else:
        get_project_url = "/project/byName"
        project_response = client.get(get_project_url, params={"name": project})

    if project_response.status_code >= 400:
        if not create_project and not is_valid_UUIDv4(project):
            raise AccessDeniedException(
                f"The project '{project}' does not exist or you do not have access to it.\n"
                f"Consider using the following command to create a project: 'klein project create' "
                f"or consider passing the flag '--create-project' to create the project automatically.",
                f"{project_response.json()['message']} ({project_response.status_code})",
            )
        elif is_valid_UUIDv4(project):
            raise ValueError(
                f"Project '{project}' does not exist. UUIDs cannot be used to create projects.\n"
                f"Please provide a valid project name or consider creating the project using the"
                f" following command: 'klein project create'"
            )
        else:
            print(f"Project '{project}' does not exist. Creating it now.")
            create_project_url = "/project/create"
            project_response = client.post(
                create_project_url,
                json={
                    "name": project,
                    "description": "autogenerated with kleinkram CLI",
                    "requiredTags": [],
                },
            )
            if project_response.status_code >= 400:
                msg = str(project_response.json()["message"])
                raise ValueError(
                    f"Failed to create project. Status Code: "
                    f"{str(project_response.status_code)}\n"
                    f"{msg}"
                )
            print("Project created successfully.")

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

    required_tags = (
        project_json["requiredTags"] if "requiredTags" in project_json else []
    )
    promptForTags(tags_dict, required_tags)

    ##############################
    # Check if mission exists
    ##############################
    if is_valid_UUIDv4(mission):
        get_mission_url = "/mission/one"
        mission_response = client.get(get_mission_url, params={"uuid": mission})
    else:
        get_mission_url = "/mission/byName"
        mission_response = client.get(get_mission_url, params={"name": mission})

    if mission_response.status_code >= 400:
        if not create_mission:
            raise AccessDeniedException(
                f"The mission '{mission}' does not exist or you do not have access to it.\n"
                f"Consider using the following command to create a mission: 'klein mission create' "
                f"or consider passing the flag '--create-mission' to create the mission automatically.",
                f"{mission_response.json()['message']} ({mission_response.status_code})",
            )
        else:
            print(f"Mission '{mission}' does not exist. Creating it now.")
            create_mission_url = "/mission/create"
            mission_response = client.post(
                create_mission_url,
                json={
                    "name": mission,
                    "projectUUID": project_json["uuid"],
                    "tags": tags_dict,
                },
            )
            if mission_response.status_code >= 400:
                raise ValueError(
                    f"Failed to create mission. Status Code: "
                    f"{str(mission_response.status_code)}\n"
                    f"{mission_response.json()['message'][0]}"
                )

    mission_json = mission_response.json()

    files = []
    for p in path:
        files.extend(expand_and_match(p))

    print(
        f"Uploading the following files to mission '{mission_json['name']}' in project '{project_json['name']}':"
    )
    filename_filepaths_map = {}
    for path in files:
        if not os.path.isdir(path):

            filename = path.split("/")[-1]
            filename_without_extension, extension = os.path.splitext(filename)
            if fix_filenames:

                # replace all non-alphanumeric characters with underscores
                filename_without_extension = "".join(
                    char if char.isalnum() else "_"
                    for char in filename_without_extension
                )

                # trim filename to 40 characters
                filename_without_extension = filename_without_extension[:40]
                filename = f"{filename_without_extension}{extension}"

            if (
                not filename.replace(".", "")
                .replace("_", "")
                .replace("-", "")
                .isalnum()
            ):
                raise ValueError(
                    f"Filename '{filename}' is not valid. It must only contain alphanumeric characters, underscores and "
                    f"hyphens. Consider using the '--fix-filenames' option to automatically fix the filenames."
                )

            if not 3 <= len(filename_without_extension) <= 40:
                raise ValueError(
                    f"Filename '{filename}' is not valid. It must be between 3 and 40 characters long. Consider using "
                    f"the '--fix-filenames' option to automatically fix the filenames."
                )

            filename_filepaths_map[filename] = path
            typer.secho(f" - {filename}", fg=typer.colors.RESET)
    print("\n\n")

    filenames = list(filename_filepaths_map.keys())

    if not filenames:
        raise ValueError("No files found matching the given path.")

    # validate filenames
    if len(filenames) != len(set(filenames)):
        raise ValueError(
            "Filenames must be unique. Please check the files you are trying to upload. This can happen if you have "
            "multiple files with the same name in different directories or use the '--fix-filenames' option."
        )

    # check if files already exist
    get_files_url = "/file/ofMission"
    response = client.get(
        get_files_url,
        params={"uuid": mission_json["uuid"]},
    )
    if response.status_code >= 400:
        raise ValueError(
            "Failed to check for existing files. Status Code: "
            + str(response.status_code)
            + "\n"
            + response.json()["message"]
        )

    existing_files = response.json()[0]
    conflicting_files = [
        file for file in existing_files if file["filename"] in filenames
    ]

    if conflicting_files and len(conflicting_files):
        print("The following files already exist in the mission:")
        for file in conflicting_files:
            typer.secho(f" - {file['filename']}", fg=typer.colors.RED, nl=False)
            if overwrite or overwrite_all:
                # delete existing files
                delete_files_url = f"/file/{file['uuid']}"
                response = client.delete(delete_files_url)
                if response.status_code >= 400:
                    raise ValueError(
                        "Failed to delete existing files. Status Code: "
                        + str(response.status_code)
                        + "\n"
                        + response.json()["message"]
                    )
                print("   » deleted")

                # check if converted files exist
                mcap_file = file["filename"].replace(".bag", ".mcap")

                if mcap_file == file["filename"]:
                    continue

                mcap_uuid = next(
                    (
                        file["uuid"]
                        for file in existing_files
                        if file["filename"] == mcap_file
                    ),
                    None,
                )

                if mcap_uuid and overwrite_all:
                    typer.secho(f"   {mcap_file}", fg=typer.colors.RED, nl=False)
                    delete_files_url = f"/file/{mcap_uuid}"
                    response = client.delete(delete_files_url)
                    if response.status_code >= 400:
                        raise ValueError(
                            "Failed to delete existing files. Status Code: "
                            + str(response.status_code)
                            + "\n"
                            + response.json()["message"]
                        )
                    print("  » deleted")
                elif mcap_uuid and not overwrite_all:
                    print(
                        f"   {mcap_file}  » skipped (consider using '--overwrite-all' to delete this file)"
                    )
                else:
                    print("   » not found")

            else:
                print("")

        if not overwrite and not overwrite_all:
            print(
                "\nYou may use the '--overwrite' or '--overwrite-all' flag to overwrite existing files."
            )
        print("")

    get_temporary_credentials = "/file/temporaryAccess"
    response = client.post(
        get_temporary_credentials,
        json={"filenames": filenames, "missionUUID": mission_json["uuid"]},
    )
    if response.status_code >= 400:
        raise ValueError(
            "Failed to upload data. Status Code: "
            + str(response.status_code)
            + "\n"
            + response.json()["message"][0]
        )

    uploadFiles(response.json(), filename_filepaths_map, 4)


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
