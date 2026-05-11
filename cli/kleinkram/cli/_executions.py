from __future__ import annotations

import os
import re
import sys
import tarfile
import time
from typing import List
from typing import Optional
from uuid import UUID

import httpx
import requests
import typer

import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.config import get_shared_state
from kleinkram.models import Execution
from kleinkram.models import LogEntry
from kleinkram.printing import print_execution_info
from kleinkram.printing import print_execution_logs
from kleinkram.printing import print_executions_table
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import split_args

HELP = """\
Manage and inspect action executions.

You can launch new executions, list executions, get detailed information about specific executions, stream their logs,
cancel executions in progress, and retry failed executions.
"""

executions_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LAUNCH_HELP = "Launch a new execution from a template."
LIST_HELP = "List action executions. Optionally filter by mission or project."
INFO_HELP = "Get detailed information about a specific action execution."
LOGS_HELP = "Stream the logs for a specific action execution."
CANCEL_HELP = "Cancel an action execution that is in progress."
RETRY_HELP = "Retry a failed action execution."
DOWNLOAD_HELP = "Download artifacts for a specific action execution."


@executions_typer.command(help=LAUNCH_HELP, name="launch")
def launch(
    template_name: str = typer.Argument(..., help="Name or ID of the template to launch."),
    mission: str = typer.Option(..., "--mission", "-m", help="Mission ID or name to launch the execution on."),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name (to scope mission)."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the logs of the action execution."),
) -> None:
    """
    Submits an execution on a specific mission and optionally follows its logs.
    """
    client = AuthenticatedClient()
    pprint = get_shared_state().verbose

    try:
        project_ids, project_patterns = split_args([project] if project else [])
        project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

        mission_ids, mission_patterns = split_args([mission])
        mission_query = MissionQuery(
            ids=mission_ids,
            patterns=mission_patterns,
            project_query=project_query,
        )
        mission_obj = kleinkram.api.routes.get_mission(client, mission_query)
        mission_uuid = mission_obj.id
    except kleinkram.errors.MissionNotFound:
        typer.secho(f"Error: Mission '{mission}' not found.", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    except kleinkram.errors.InvalidMissionQuery:
        typer.secho(
            "Error: Mission query is ambiguous. Try specifying a project with -p.",
            fg=typer.colors.RED,
        )
        raise typer.Exit(code=1)
    except Exception as e:
        typer.secho(f"Error resolving mission: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    # 2. Resolve Template to UUID
    try:
        if is_valid_uuid4(template_name):
            template_uuid = UUID(template_name)
        else:
            templates = kleinkram.api.routes.get_templates(client)
            found_template = next((t for t in templates if t.name == template_name), None)

            if not found_template:
                typer.secho(
                    f"Error: Action template '{template_name}' not found.",
                    fg=typer.colors.RED,
                )
                raise typer.Exit(code=1)
            template_uuid = found_template.uuid
    except Exception as e:
        typer.secho(f"Error resolving template: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    try:
        execution_uuid_str = kleinkram.api.routes.launch_execution(client, mission_uuid, template_uuid)
        typer.secho(f"Action submitted. Execution ID: {execution_uuid_str}", fg=typer.colors.GREEN)

    except httpx.HTTPStatusError as e:
        typer.secho(f"Error submitting action: {e.response.text}", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    except (KeyError, Exception) as e:
        typer.secho(f"An unexpected error occurred: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    if follow:
        exit_code = kleinkram.printing.follow_execution_logs(client, execution_uuid_str)
        if exit_code != 0:
            raise typer.Exit(code=exit_code)

    elif pprint:
        # Not following, but in verbose mode. Show execution info.
        try:
            time.sleep(0.5)  # Give API a moment
            execution_details = kleinkram.api.routes.get_execution(client, execution_uuid_str)
            kleinkram.printing.print_execution_info(execution_details, pprint=True)
        except Exception:
            # Non-critical, we already printed the ID.
            pass


@executions_typer.command(help=LIST_HELP, name="list")
def list_executions(
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="Mission ID or name to filter by."),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name to filter by."),
) -> None:
    """
    List action executions.
    """
    client = AuthenticatedClient()

    mission_ids, mission_patterns = split_args([mission] if mission else [])
    project_ids, project_patterns = split_args([project] if project else [])

    query = ExecutionQuery(
        mission_ids=mission_ids,
        mission_patterns=mission_patterns,
        project_ids=project_ids,
        project_patterns=project_patterns,
    )

    executions = list(kleinkram.api.routes.get_executions(client, query=query))
    print_executions_table(executions, pprint=get_shared_state().verbose)


@executions_typer.command(name="info", help=INFO_HELP)
def get_info(execution_id: str = typer.Argument(..., help="The ID of the execution to get information for.")) -> None:
    """
    Get detailed information for a single execution.
    """
    client = AuthenticatedClient()
    execution: Execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
    print_execution_info(execution, pprint=get_shared_state().verbose)


@executions_typer.command(help=LOGS_HELP)
def logs(
    execution_id: str = typer.Argument(..., help="The ID of the execution to fetch logs for."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the log output in real-time."),
) -> None:
    """
    Fetch and display logs for a specific execution.
    """
    client = AuthenticatedClient()

    if follow:
        typer.echo(f"Watching logs for execution {execution_id}. Press Ctrl+C to stop.")
        try:

            # TODO: fine for now, but ideally we would have a streaming endpoint
            # currently there is no following, thus we just poll every 2 seconds
            # from the get_execution endpoint
            last_log_index = 0
            while True:
                execution: Execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
                log_entries: List[LogEntry] = execution.logs
                new_log_entries = log_entries[last_log_index:]
                if new_log_entries:
                    print_execution_logs(new_log_entries, pprint=get_shared_state().verbose)
                    last_log_index += len(new_log_entries)

                time.sleep(2)

        except KeyboardInterrupt:
            typer.echo("Stopped following logs.")
            sys.exit(0)
    else:
        log_entries = kleinkram.api.routes.get_execution(client, execution_id=execution_id).logs
        print_execution_logs(log_entries, pprint=get_shared_state().verbose)


def _get_filename_from_cd(cd: str) -> Optional[str]:
    """Extract filename from Content-Disposition header."""
    if not cd:
        return None
    fname = re.findall("filename=(.+)", cd)
    if len(fname) == 0:
        return None
    return fname[0].strip().strip('"')


@executions_typer.command(name="download", help=DOWNLOAD_HELP)
def download_artifacts(
    execution_id: str = typer.Argument(..., help="The ID of the execution to download artifacts for."),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Path or filename to save the artifacts to."),
    extract: bool = typer.Option(
        False,
        "--extract",
        "-x",
        help="Automatically extract the archive after downloading.",
    ),
) -> None:
    """
    Download the artifacts (.tar.gz) for a finished execution.
    """
    client = AuthenticatedClient()

    # Fetch Execution Details
    try:
        execution: Execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
    except Exception as e:
        typer.secho(f"Failed to fetch execution details: {e}", fg=typer.colors.RED)
        raise typer.Exit(1)

    if not execution.artifact_url:
        typer.secho(
            f"No artifacts found for execution {execution_id}. The execution might not be finished or artifacts expired.",
            fg=typer.colors.YELLOW,
        )
        raise typer.Exit(1)

    typer.echo(f"Downloading artifacts for execution {execution_id}...")

    # Stream Download
    try:
        with requests.get(execution.artifact_url, stream=True) as r:
            r.raise_for_status()

            # Determine Filename
            filename = output
            if not filename:
                filename = _get_filename_from_cd(r.headers.get("content-disposition"))

            if not filename:
                filename = f"{execution_id}.tar.gz"

            # If output is a directory, join with filename
            if output and os.path.isdir(output):
                filename = os.path.join(
                    output,
                    _get_filename_from_cd(r.headers.get("content-disposition")) or f"{execution_id}.tar.gz",
                )

            total_length = int(r.headers.get("content-length", 0))

            # Write to file with Progress Bar
            with open(filename, "wb") as f:
                with typer.progressbar(length=total_length, label=f"Saving to {filename}") as progress:
                    for chunk in r.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            progress.update(len(chunk))

            typer.secho(f"\nSuccessfully downloaded to {filename}", fg=typer.colors.GREEN)

            # Extraction Logic
            if extract:
                try:
                    # Determine extraction directory (based on filename without extension)
                    # e.g., "downloads/my-execution.tar" -> "downloads/my-execution"
                    base_name = os.path.basename(filename)
                    folder_name = base_name.split(".")[0]

                    # Get the parent directory of the downloaded file
                    parent_dir = os.path.dirname(os.path.abspath(filename))
                    extract_path = os.path.join(parent_dir, folder_name)

                    typer.echo(f"Extracting to: {extract_path}...")

                    with tarfile.open(filename, "r:gz") as tar:

                        # Safety check: filter_data prevents extraction outside target dir (CVE-2007-4559)
                        # Available in Python 3.12+, for older python use generic extractall
                        if hasattr(tarfile, "data_filter"):
                            tar.extractall(path=extract_path, filter="data")
                        else:
                            tar.extractall(path=extract_path)

                    typer.secho("Successfully extracted.", fg=typer.colors.GREEN)

                except tarfile.TarError as e:
                    typer.secho(f"Failed to extract archive: {e}", fg=typer.colors.RED)

    except requests.exceptions.RequestException as e:
        typer.secho(f"Error downloading file: {e}", fg=typer.colors.RED)
        raise typer.Exit(1)
