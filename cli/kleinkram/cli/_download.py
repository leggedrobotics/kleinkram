from __future__ import annotations

import logging
from datetime import timezone
from pathlib import Path
from typing import List
from typing import Optional

import dateutil.parser
import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import DownloadState
from kleinkram.api.file_transfer import McapSlice
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli._progress import transfer_progress
from kleinkram.config import get_shared_state
from kleinkram.utils import format_bytes
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)


def _parse_log_time(value: Optional[str], flag: str) -> Optional[int]:
    """Parse a slice bound into MCAP log time (nanoseconds since the epoch).

    Accepts an ISO 8601 timestamp, which is what `klein file info` prints, or a
    raw nanosecond count for callers that already have one.
    """
    if value is None:
        return None

    if value.isdigit():
        return int(value)

    try:
        parsed = dateutil.parser.isoparse(value)
    except ValueError as e:
        raise typer.BadParameter(
            f"{flag} must be an ISO 8601 timestamp (e.g. 2026-09-18T08:08:28Z) "
            f"or nanoseconds since the epoch, got {value!r}"
        ) from e

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1_000_000_000)


HELP = """\
Download files from kleinkram.

Passing --topics, --start-time or --end-time downloads only part of each .mcap,
using the file's own index to fetch just the chunks that hold the selected
messages. Files that are not .mcap cannot be sliced and are skipped.
"""


download_typer = typer.Typer(name="download", no_args_is_help=True, invoke_without_command=True, help=HELP)


@download_typer.callback()
def download(
    files: Optional[List[str]] = typer.Argument(None, help="file names, ids or patterns"),
    projects: Optional[List[str]] = typer.Option(None, "--project", "-p", help="project names, ids or patterns"),
    missions: Optional[List[str]] = typer.Option(None, "--mission", "-m", help="mission names, ids or patterns"),
    dest: str = typer.Option(prompt="destination", help="local path to save the files"),
    nested: bool = typer.Option(False, help="save files in nested directories, project-name/mission-name"),
    overwrite: bool = typer.Option(
        False,
        help="overwrite files if they already exist and don't match the file size or file hash",
    ),
    include_corrupt_files: bool = typer.Option(
        False,
        help="download files marked as CORRUPTED (potentially dangerous, use with caution)",
    ),
    yes: bool = typer.Option(
        False,
        "--yes",
        "-y",
        help="skip all confirmation prompts",
    ),
    allow_corrupt: bool = typer.Option(
        False,
        "--allow-corrupt",
        help="skip confirmation prompt for downloading files marked as CORRUPTED",
    ),
    create_dirs: bool = typer.Option(
        False,
        "--create-dirs",
        help="create missing destination directories without prompting",
    ),
    topics: Optional[List[str]] = typer.Option(
        None,
        "--topics",
        help="only keep these topics (.mcap only); repeatable",
    ),
    start_time: Optional[str] = typer.Option(
        None,
        "--start-time",
        help="drop messages logged before this ISO 8601 time (.mcap only)",
    ),
    end_time: Optional[str] = typer.Option(
        None,
        "--end-time",
        help="drop messages logged at or after this ISO 8601 time (.mcap only)",
    ),
) -> None:
    if include_corrupt_files:
        typer.secho(
            "Warning: --include-corrupt-files enables downloading files marked as CORRUPTED. "
            "These files may be harmful. Do not execute or open them blindly.",
            fg=typer.colors.YELLOW,
            err=True,
        )
        if not (yes or allow_corrupt):
            typer.confirm("Do you want to continue? You can use --yes or --allow-corrupt to skip this prompt.", abort=True)

    mcap_slice = McapSlice(
        topics=tuple(topics) if topics else None,
        start_time=_parse_log_time(start_time, "--start-time"),
        end_time=_parse_log_time(end_time, "--end-time"),
    )

    if mcap_slice:
        if mcap_slice.start_time is not None and mcap_slice.end_time is not None:
            if mcap_slice.end_time <= mcap_slice.start_time:
                raise typer.BadParameter("--end-time must be after --start-time")

        # Worth saying plainly: a topic filter shrinks the written file but
        # normally not the transfer, because an MCAP chunk holds several topics
        # and is the smallest unit that can be fetched.
        if mcap_slice.topics and mcap_slice.start_time is None and mcap_slice.end_time is None:
            typer.secho(
                "Note: --topics alone rarely reduces how much is transferred, only the size of "
                "the written file. Add --start-time/--end-time to transfer less.",
                fg=typer.colors.YELLOW,
                err=True,
            )

        typer.secho(
            "Partial download: only .mcap files will be downloaded, and only in part.",
            fg=typer.colors.YELLOW,
            err=True,
        )

    # create destination directory
    dest_dir = Path(dest)
    if not dest_dir.exists():
        if not (yes or create_dirs):
            typer.confirm(
                f"Destination {dest_dir} does not exist. Create it? You can use --yes or --create-dirs to skip this prompt.",
                abort=True,
            )
    dest_dir.mkdir(parents=True, exist_ok=True)

    # get file query
    file_ids, file_patterns = split_args(files or [])
    mission_ids, mission_patterns = split_args(missions or [])
    project_ids, project_patterns = split_args(projects or [])

    project_query = ProjectQuery(patterns=project_patterns, ids=project_ids)
    mission_query = MissionQuery(
        patterns=mission_patterns,
        ids=mission_ids,
        project_query=project_query,
    )
    file_query = FileQuery(patterns=file_patterns, ids=file_ids, mission_query=mission_query)

    verbose = get_shared_state().verbose

    if verbose:
        # We don't know total file count upfront (core.download resolves the query),
        # so we use an indeterminate overall task (total=None)
        with transfer_progress("Downloading files", total=None) as cbs:
            result = kleinkram.core.download(
                client=AuthenticatedClient(),
                query=file_query,
                allow_corrupt_files=include_corrupt_files,
                base_dir=dest_dir,
                nested=nested,
                overwrite=overwrite,
                mcap_slice=mcap_slice if mcap_slice else None,
                on_overall_progress_cb=cbs.on_overall_progress,
                on_file_start_cb=cbs.on_file_start,
                on_file_progress_cb=cbs.on_file_progress,
                on_message_cb=cbs.on_message,
            )

        # Print summary
        avg_speed = result.total_bytes / result.elapsed_seconds if result.elapsed_seconds > 0 else 0
        typer.echo(f"\nDownload took {result.elapsed_seconds:.2f} seconds")
        label = "Total transferred" if mcap_slice else "Total downloaded/verified"
        typer.echo(f"{label}: {format_bytes(result.total_bytes)}")
        typer.echo(f"Average speed: {format_bytes(avg_speed, speed=True)}")
        typer.echo(
            "Summary: "
            f"{result.state_counts.get(DownloadState.DOWNLOADED_OK, 0)} downloaded OK, "
            f"{result.state_counts.get(DownloadState.DOWNLOADED_PARTIAL, 0)} downloaded partially, "
            f"{result.state_counts.get(DownloadState.SKIPPED_NOT_SLICEABLE, 0)} skipped not sliceable, "
            f"{result.state_counts.get(DownloadState.DOWNLOADED_CORRUPTED, 0)} downloaded corrupted, "
            f"{result.state_counts.get(DownloadState.OVERWRITTEN_OK, 0)} overwritten OK, "
            f"{result.state_counts.get(DownloadState.OVERWRITTEN_CORRUPTED, 0)} overwritten corrupted, "
            f"{result.state_counts.get(DownloadState.SKIPPED_OK, 0)} skipped already-present, "
            f"{result.state_counts.get(DownloadState.SKIPPED_CORRUPTED, 0)} skipped corrupted (blocked), "
            f"{result.state_counts.get(DownloadState.SKIPPED_CORRUPTED_LOCAL_OK, 0)} skipped corrupted (already present), "
            f"{result.state_counts.get(DownloadState.SKIPPED_INVALID_HASH, 0)} skipped hash mismatch, "
            f"{result.state_counts.get(DownloadState.SKIPPED_FILE_SIZE_MISMATCH, 0)} skipped size mismatch, "
            f"{result.state_counts.get(DownloadState.SKIPPED_INVALID_REMOTE_STATE, 0)} skipped invalid remote state, "
            f"{result.state_counts.get(DownloadState.DOWNLOADED_INVALID_HASH, 0)} downloaded with invalid hash, "
            f"{result.failed} failed"
        )
    else:
        # No verbose: no progress bars, no callbacks
        result = kleinkram.core.download(
            client=AuthenticatedClient(),
            query=file_query,
            allow_corrupt_files=include_corrupt_files,
            base_dir=dest_dir,
            nested=nested,
            overwrite=overwrite,
            mcap_slice=mcap_slice if mcap_slice else None,
        )

        downloaded = (
            result.state_counts.get(DownloadState.DOWNLOADED_OK, 0)
            + result.state_counts.get(DownloadState.DOWNLOADED_PARTIAL, 0)
            + result.state_counts.get(DownloadState.DOWNLOADED_CORRUPTED, 0)
            + result.state_counts.get(DownloadState.OVERWRITTEN_OK, 0)
            + result.state_counts.get(DownloadState.OVERWRITTEN_CORRUPTED, 0)
        )
        if result.failed > 0:
            typer.echo(
                typer.style(
                    f"\nDownloaded {downloaded} file(s), {result.failed} failed.",
                    fg=typer.colors.RED,
                ),
                err=True,
            )
        else:
            typer.echo(
                typer.style(
                    f"\nSuccessfully downloaded/verified {downloaded} file(s).",
                    fg=typer.colors.GREEN,
                )
            )
