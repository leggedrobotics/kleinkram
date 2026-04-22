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
import kleinkram.core
import kleinkram.errors
import kleinkram.printing
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
    try:
        kleinkram.core.download_artifact(
            execution_id=execution_id,
            output=output,
            extract=extract,
            verbose=get_shared_state().verbose,
        )
    except Exception as e:
        import typer

        typer.secho(f"Failed to download artifacts: {e}", fg=typer.colors.RED)
        raise typer.Exit(1)
