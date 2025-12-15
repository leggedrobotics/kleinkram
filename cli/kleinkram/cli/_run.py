from __future__ import annotations

import os
import re
import sys
import tarfile
import time
from typing import List
from typing import Optional

import requests
import typer

import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import RunQuery
from kleinkram.config import get_shared_state
from kleinkram.models import LogEntry
from kleinkram.models import Run
from kleinkram.printing import print_run_info
from kleinkram.printing import print_run_logs
from kleinkram.printing import print_runs_table
from kleinkram.utils import split_args

HELP = """\
Manage and inspect action runs.

You can list action runs, get detailed information about specific runs, stream their logs,
cancel runs in progress, and retry failed runs.
"""

run_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "List action runs. Optionally filter by mission or project."
INFO_HELP = "Get detailed information about a specific action run."
LOGS_HELP = "Stream the logs for a specific action run."
CANCEL_HELP = "Cancel an action run that is in progress."
RETRY_HELP = "Retry a failed action run."
DOWNLOAD_HELP = "Download artifacts for a specific action run."


@run_typer.command(help=LIST_HELP, name="list")
def list_runs(
    mission: Optional[str] = typer.Option(None, "--mission", "-m", help="Mission ID or name to filter by."),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name to filter by."),
) -> None:
    """
    List action runs.
    """
    client = AuthenticatedClient()

    mission_ids, mission_patterns = split_args([mission] if mission else [])
    project_ids, project_patterns = split_args([project] if project else [])

    query = RunQuery(
        mission_ids=mission_ids,
        mission_patterns=mission_patterns,
        project_ids=project_ids,
        project_patterns=project_patterns,
    )

    runs = list(kleinkram.api.routes.get_runs(client, query=query))
    print_runs_table(runs, pprint=get_shared_state().verbose)


@run_typer.command(name="info", help=INFO_HELP)
def get_info(run_id: str = typer.Argument(..., help="The ID of the run to get information for.")) -> None:
    """
    Get detailed information for a single run.
    """
    client = AuthenticatedClient()
    run: Run = kleinkram.api.routes.get_run(client, run_id=run_id)
    print_run_info(run, pprint=get_shared_state().verbose)


@run_typer.command(help=LOGS_HELP)
def logs(
    run_id: str = typer.Argument(..., help="The ID of the run to fetch logs for."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the log output in real-time."),
) -> None:
    """
    Fetch and display logs for a specific run.
    """
    client = AuthenticatedClient()

    if follow:
        typer.echo(f"Watching logs for run {run_id}. Press Ctrl+C to stop.")
        try:

            # TODO: fine for now, but ideally we would have a streaming endpoint
            # currently there is no following, thus we just poll every 2 seconds
            # from the get_run endpoint
            last_log_index = 0
            while True:
                run: Run = kleinkram.api.routes.get_run(client, run_id=run_id)
                log_entries: List[LogEntry] = run.logs
                new_log_entries = log_entries[last_log_index:]
                if new_log_entries:
                    print_run_logs(new_log_entries, pprint=get_shared_state().verbose)
                    last_log_index += len(new_log_entries)

                time.sleep(2)

        except KeyboardInterrupt:
            typer.echo("Stopped following logs.")
            sys.exit(0)
    else:
        log_entries = kleinkram.api.routes.get_run(client, run_id=run_id).logs
        print_run_logs(log_entries, pprint=get_shared_state().verbose)


def _get_filename_from_cd(cd: str) -> Optional[str]:
    """Extract filename from Content-Disposition header."""
    if not cd:
        return None
    fname = re.findall("filename=(.+)", cd)
    if len(fname) == 0:
        return None
    return fname[0].strip().strip('"')


@run_typer.command(name="download", help=DOWNLOAD_HELP)
def download_artifacts(
    run_id: str = typer.Argument(..., help="The ID of the run to download artifacts for."),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Path or filename to save the artifacts to."),
    extract: bool = typer.Option(
        False,
        "--extract",
        "-x",
        help="Automatically extract the archive after downloading.",
    ),
) -> None:
    """
    Download the artifacts (.tar.gz) for a finished run.
    """
    client = AuthenticatedClient()

    # Fetch Run Details
    try:
        run: Run = kleinkram.api.routes.get_run(client, run_id=run_id)
    except Exception as e:
        typer.secho(f"Failed to fetch run details: {e}", fg=typer.colors.RED)
        raise typer.Exit(1)

    if not run.artifact_url:
        typer.secho(
            f"No artifacts found for run {run_id}. The run might not be finished or artifacts expired.",
            fg=typer.colors.YELLOW,
        )
        raise typer.Exit(1)

    typer.echo(f"Downloading artifacts for run {run_id}...")

    # Stream Download
    try:
        with requests.get(run.artifact_url, stream=True) as r:
            r.raise_for_status()

            # Determine Filename
            filename = output
            if not filename:
                filename = _get_filename_from_cd(r.headers.get("content-disposition"))

            if not filename:
                filename = f"{run_id}.tar.gz"

            # If output is a directory, join with filename
            if output and os.path.isdir(output):
                filename = os.path.join(
                    output,
                    _get_filename_from_cd(r.headers.get("content-disposition")) or f"{run_id}.tar.gz",
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
                    # e.g., "downloads/my-run.tar" -> "downloads/my-run"
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
