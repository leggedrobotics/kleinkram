from __future__ import annotations

import importlib.metadata
import os
from datetime import datetime
from datetime import timedelta
from enum import Enum
from itertools import chain
from typing import Any
from typing import cast
from typing import Dict
from typing import List
from typing import Optional
from typing import Union
from uuid import UUID

import httpx
import typer
from rich import print
from rich.table import Table
from typer.core import TyperGroup
from typer.models import Context
from typing_extensions import Annotated

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import claim_admin
from kleinkram.api.routes import get_upload_creditials
from kleinkram.auth.auth import login
from kleinkram.auth.auth import logout
from kleinkram.auth.auth import setCliKey
from kleinkram.endpoint.endpoint import endpoint
from kleinkram.error_handling import AccessDeniedException
from kleinkram.error_handling import ErrorHandledTyper
from kleinkram.file.file import file
from kleinkram.mission.mission import missionCommands
from kleinkram.project.project import project
from kleinkram.queue.queue import queue
from kleinkram.tag.tag import tag
from kleinkram.topic.topic import topic
from kleinkram.user.user import user
from kleinkram.utils import canUploadMission
from kleinkram.utils import get_internal_file_map
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import matched_paths
from kleinkram.utils import prompt_required_tags
from kleinkram.utils import upload_files


class CommandPanel(str, Enum):
    COMMANDS = "COMMANDS"
    CORE_COMMANDS = "CORE COMMANDS"
    ADDITIONAL_COMMANDS = "ADDITIONAL COMMANDS"


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
        _ = _ctx  # unused

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
            for name, _ in sorted(
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


app.add_typer(project, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(missionCommands, rich_help_panel=CommandPanel.COMMANDS)

app.add_typer(topic, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(file, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(queue, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(user, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(tag, rich_help_panel=CommandPanel.COMMANDS)
app.add_typer(endpoint, rich_help_panel=CommandPanel.ADDITIONAL_COMMANDS)

app.command(rich_help_panel=CommandPanel.ADDITIONAL_COMMANDS)(login)
app.command(rich_help_panel=CommandPanel.ADDITIONAL_COMMANDS)(logout)
app.command(hidden=True)(setCliKey)


@app.command("download", rich_help_panel=CommandPanel.CORE_COMMANDS)
def download():
    print(
        "Not implemented yet. Consider using the 'klein file download' or 'klein mission download' commands."
    )


@app.command("upload", rich_help_panel=CommandPanel.CORE_COMMANDS, no_args_is_help=True)
def upload(
    path: Annotated[
        List[str],
        typer.Option(help="Path to files to upload, Regex supported"),
    ],
    project: Annotated[str, typer.Option(help="Name or UUID of a Project")],
    mission: Annotated[str, typer.Option(help="Name of UUID Mission to create")],
    tags: Annotated[
        List[str],
        typer.Option(help="Tags to add to the mission"),
    ],
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
):
    """
    Upload files matching the path to a mission in a project.

    The mission name must be unique within the project and not yet created.\n
    Multiple paths can be given by using the option multiple times.\n
    Examples:\n
        - 'klein upload --path "~/data/**/*.bag" --project "Project 1" --mission "Mission 1" --tags "0700946d-1d6a-4520-b263-0e177f49c35b:LEE-H" --tags "1565118d-593c-4517-8c2d-9658452d9319:Dodo"'\n

    """

    client = AuthenticatedClient()

    # check if project exists, if `project` is a UUID search by uuid else search by name
    if is_valid_uuid4(project):
        get_project_url = "/project/one"
        project_response = client.get(get_project_url, params={"uuid": project})
    else:
        get_project_url = "/project/byName"
        project_response = client.get(get_project_url, params={"name": project})

    if project_response.status_code >= 400:
        if not create_project and not is_valid_uuid4(project):
            raise AccessDeniedException(
                f"The project `{project}` does not exist or you do not have access to it.\n"
                "Consider using the following command to create a project: "
                "`klein project create` or consider passing the flag "
                "`--create-project` to create the project automatically.",
                f"{project_response.json()['message']} ({project_response.status_code})",
            )
        elif is_valid_uuid4(project):
            raise ValueError(
                f"The project `{project}` does not exist or you do not have access to it.\n"
                "UUIDs cannot be used to create projects.\n"
                "Please provide a valid project name or consider creating "
                "the project using the following command: `klein project create`"
            )
        else:
            print(f"Project '{project}' does not exist. Creating it now.")
            create_project_url = "/project/create"
            project_response = client.post(
                create_project_url,
                json={
                    "name": project,
                    "description": "Autogenerated by klein CLI",
                    "requiredTags": [],
                },
            )
            if project_response.status_code >= 400:
                raise ValueError(
                    f"Failed to create project. Status Code: "
                    f"{str(project_response.status_code)}\n"
                    f"{project_response.json()['message'][0]}"
                )
            print("Project created successfully.")

    project_json = project_response.json()
    if project_json["uuid"] is None:
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
        cast(dict[str, str], project_json["requiredTags"])
        if "requiredTags" in project_json
        else {}
    )
    # TODO
    prompt_required_tags(tags_dict, required_tags)

    # check if mission exists, if `mission` is a UUID search by uuid else search by name
    if is_valid_uuid4(mission):
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
    print(
        f"Uploading the following files to mission '{mission_json['name']}' in project '{project_json['name']}':"
    )

    paths = list(chain(*(matched_paths(p) for p in path)))
    if not paths:
        # should we raise this error inside `matched_paths` function?
        raise ValueError("No files found matching the given path.")

    internal_filename_map = get_internal_file_map(paths)

    if not fix_filenames:
        for external, internal in internal_filename_map.items():
            if external != internal:
                raise ValueError(
                    f"Filename '{external}' is not valid.\n"
                    " - It must only contain alphanumeric characters"
                    "underscores and hyphens.\n"
                    " - It must be between 3 and 40 characters long.\n\n"
                    "Consider using the '--fix-filenames' option "
                    "to automatically fix the filenames."
                )
    else:
        mismatched = [
            (ext, _int) for ext, _int in internal_filename_map.items() if ext != _int
        ]
        if mismatched:
            print("Fixing filenames internally...")
            for ext, _int in mismatched:
                print(f" - {ext} -> {_int}")

    files_with_access = get_upload_creditials(
        client, list(internal_filename_map.values()), mission_json["uuid"]
    )

    upload_files(files_with_access, internal_filename_map, n_workers=4)


@queue.command("list")
def list_queue():
    """List current Queue entities"""
    try:
        url = "/queue/active"
        start_date = datetime.now().date() - timedelta(days=1)

        client = AuthenticatedClient()
        response = client.get(url, params={"startDate": str(start_date)})
        response.raise_for_status()
    except httpx.HTTPError as e:
        print(e)
    else:
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


@app.command("claim", hidden=True)
def claim():
    """
    Claim admin rights as the first user

    Only works if no other user has claimed admin rights before.
    """
    claim_admin()
    print("Admin rights claimed successfully.")


def main() -> int:
    app()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
