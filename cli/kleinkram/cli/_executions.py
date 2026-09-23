from __future__ import annotations

import sys
import time
from typing import List
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
import kleinkram.printing
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import ExecutionQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import require
from kleinkram.config import get_shared_state
from kleinkram.models import Execution
from kleinkram.models import LogEntry
from kleinkram.printing import print_diagnostics
from kleinkram.printing import print_execution_info
from kleinkram.printing import print_execution_logs
from kleinkram.printing import print_executions_table
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import split_args

HELP = """\
Manage and inspect action executions.

You can launch new executions, delete executions, list executions, get detailed information about specific executions,
stream their logs and download their artifacts.
"""

execution_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LAUNCH_HELP = "Launch a new execution from a template."
LIST_HELP = "List action executions. Optionally filter by mission or project."
INFO_HELP = "Get detailed information about a specific action execution."
LOGS_HELP = "Stream the logs for a specific action execution."
DELETE_HELP = "Delete a specific action execution."
DOWNLOAD_HELP = "Download artifacts for a specific action execution."
CANCEL_HELP = "Cancel a running action execution."
DIAGNOSTICS_HELP = "List the warnings and errors an execution reported."


@execution_typer.command(help=LAUNCH_HELP, name="launch", cls=CompatCommand)
def launch(
    template: str = typer.Argument(..., metavar="TEMPLATE", help="Name or ID of the template to launch."),
    mission_arg: Optional[str] = typer.Argument(None, metavar="MISSION", hidden=True),
    mission: Optional[str] = typer.Option(
        None, "--mission", "-m", help="Mission ID or name to launch the execution on (required)"
    ),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name (to scope mission)."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the logs of the action execution."),
) -> None:
    """
    Submits an execution on a specific mission and optionally follows its logs.
    """
    mission = require(prefer_new(mission, mission_arg, old="the positional MISSION argument", new="--mission/-m"), "--mission")

    client = AuthenticatedClient()
    pprint = get_shared_state().verbose

    project_ids, project_patterns = split_args([project] if project else [])
    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

    mission_ids, mission_patterns = split_args([mission])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )

    typer.echo("Submitting action...")
    try:
        execution_uuid = kleinkram.core.launch_execution(
            client=client,
            mission_query=mission_query,
            template=template,
        )
    except kleinkram.errors.InvalidMissionQuery as e:
        raise kleinkram.errors.InvalidMissionQuery("Mission query is ambiguous. Try specifying a project with -p.") from e
    typer.secho(f"Action submitted. Execution ID: {execution_uuid}", fg=typer.colors.GREEN)

    if follow:
        exit_code = kleinkram.printing.follow_execution_logs(client, execution_uuid)
        if exit_code != 0:
            raise typer.Exit(code=exit_code)

    elif pprint:
        # Not following, but in verbose mode. Show execution info.
        try:
            time.sleep(0.5)  # Give API a moment
            execution_details = kleinkram.api.routes.get_execution(client, execution_uuid)
            kleinkram.printing.print_execution_info(execution_details, pprint=True)
        except Exception:
            # Non-critical, we already printed the ID.
            pass


@execution_typer.command(help=LIST_HELP, name="list")
def list_executions(
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name to filter executions by."),
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="Mission ID or name to filter executions by."),
    template_name: Optional[str] = typer.Option(None, "--template", "-t", help="Template name to filter executions by."),
    project_uuid: Optional[str] = typer.Option(None, "--project-uuid", hidden=True),
    mission_uuid: Optional[str] = typer.Option(None, "--mission-uuid", hidden=True),
    template_name_flag: Optional[str] = typer.Option(None, "--template-name", hidden=True),
) -> None:
    """
    List action executions.
    """
    project = prefer_new(project, project_uuid, old="--project-uuid", new="--project/-p")
    mission = prefer_new(mission, mission_uuid, old="--mission-uuid", new="--mission/-m")
    template_name = prefer_new(template_name, template_name_flag, old="--template-name", new="--template/-t")

    client = AuthenticatedClient()

    project_id = None
    if project is not None:
        project_ids, project_patterns = split_args([project])
        project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
        project_id = kleinkram.api.routes.get_project(client, project_query, exact_match=True).id

    mission_id = None
    if mission is not None:
        mission_ids, mission_patterns = split_args([mission])
        project_ids, project_patterns = split_args([project] if project else [])
        mission_query = MissionQuery(
            ids=mission_ids,
            patterns=mission_patterns,
            project_query=ProjectQuery(ids=project_ids, patterns=project_patterns),
        )
        mission_id = kleinkram.api.routes.get_mission(client, mission_query).id

    query = None
    if project_id is not None or mission_id is not None or template_name:
        query = ExecutionQuery(
            project_uuid=project_id,
            mission_uuid=mission_id,
            template_name=template_name,
        )

    executions = list(kleinkram.api.routes.get_executions(client, query=query))
    print_executions_table(executions, pprint=get_shared_state().verbose)


@execution_typer.command(help=DELETE_HELP, name="delete")
def delete(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID (UUID) of the execution to delete."),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
) -> None:
    """
    Delete a specific action execution by its ID.
    """

    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")
    execution_id = parse_uuid_like(execution)

    confirm_deletion(f"delete execution {execution_id}", yes=yes, legacy_no_prompt=True)

    client = AuthenticatedClient()
    kleinkram.core.delete_execution(client=client, execution_id=execution_id)
    typer.secho(f"Execution {execution_id} deleted successfully.", fg=typer.colors.GREEN)


@execution_typer.command(help=CANCEL_HELP, name="cancel")
def cancel(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID (UUID) of the execution to cancel.")
) -> None:
    """
    Cancel a running action execution by its ID.
    """
    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")
    execution_id = parse_uuid_like(execution)

    client = AuthenticatedClient()
    kleinkram.core.cancel_execution(client=client, execution_id=execution_id)
    typer.secho(f"Execution {execution_id} cancellation requested.", fg=typer.colors.GREEN)


@execution_typer.command(name="info", help=INFO_HELP)
def get_info(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID of the execution to get information for.")
) -> None:
    """
    Get detailed information for a single execution.
    """
    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")
    execution_id = parse_uuid_like(execution)

    client = AuthenticatedClient()
    execution_obj: Execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
    print_execution_info(execution_obj, pprint=get_shared_state().verbose)


@execution_typer.command(name="diagnostics", help=DIAGNOSTICS_HELP)
def diagnostics(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID of the execution to list diagnostics for.")
) -> None:
    """
    List what an execution reported about itself through `klein action warn` / `fail`.
    """
    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")
    execution_id = parse_uuid_like(execution)

    client = AuthenticatedClient()
    entries, truncated = kleinkram.core.get_diagnostics(client=client, execution_id=execution_id)
    print_diagnostics(entries, truncated=truncated, pprint=get_shared_state().verbose)


@execution_typer.command(help=LOGS_HELP)
def logs(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID of the execution to fetch logs for."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the log output in real-time."),
) -> None:
    """
    Fetch and display logs for a specific execution.
    """
    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")
    execution_id = parse_uuid_like(execution)

    client = AuthenticatedClient()

    if follow:
        typer.echo(f"Watching logs for execution {execution_id}. Press Ctrl+C to stop.")
        try:

            # TODO: fine for now, but ideally we would have a streaming endpoint
            # currently there is no following, thus we just poll every 2 seconds
            # from the get_execution endpoint
            last_log_index = 0
            while True:
                execution_obj: Execution = kleinkram.api.routes.get_execution(client, execution_id=execution_id)
                log_entries: List[LogEntry] = execution_obj.logs
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


@execution_typer.command(name="download", help=DOWNLOAD_HELP)
def download_artifacts(
    execution: str = typer.Argument(..., metavar="EXECUTION_ID", help="The ID of the execution to download artifacts for."),
    output_dir: Optional[str] = typer.Option(
        None, "--output-dir", "-o", help="Directory to save the artifacts to (defaults to current directory)."
    ),
    filename: Optional[str] = typer.Option(None, "--filename", help="Filename to save the artifact as (must end in .tar.gz)."),
    extract: bool = typer.Option(
        False,
        "--extract",
        "-x",
        help="Automatically extract the archive after downloading.",
    ),
    filename_flag: Optional[str] = typer.Option(None, "-f", hidden=True),
) -> None:
    """
    Download the artifacts (.tar.gz) for a finished execution.
    """
    filename = prefer_new(filename, filename_flag, old="-f for --filename", new="--filename")
    if not is_valid_uuid4(execution):
        raise typer.BadParameter(f"'{execution}' is not a valid UUID.")

    execution_id = parse_uuid_like(execution)

    client = AuthenticatedClient()
    kleinkram.core.download_artifact(
        client=client,
        execution_id=execution_id,
        output_dir=output_dir,
        filename=filename,
        extract=extract,
        verbose=get_shared_state().verbose,
    )
