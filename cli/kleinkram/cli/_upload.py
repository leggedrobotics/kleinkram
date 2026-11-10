from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
import kleinkram.utils
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli._deprecation import warn_deprecated
from kleinkram.cli._file_expansion import expand_file_args
from kleinkram.cli._file_validator import FileValidator
from kleinkram.cli._file_validator import _report_skipped_files
from kleinkram.cli._file_validator import supported_suffixes
from kleinkram.cli._progress import run_interruptible
from kleinkram.cli._progress import transfer_progress
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionNotFound
from kleinkram.utils import format_bytes
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

HELP = """\
Upload files to kleinkram.
"""

upload_typer = typer.Typer(
    name="upload",
    no_args_is_help=True,
    invoke_without_command=True,
    help=HELP,
)


def _build_mission_query(mission: str, project: Optional[str]) -> MissionQuery:
    """Constructs the MissionQuery object from CLI args."""
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])

    project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)
    return MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=project_query,
    )


def _handle_no_files_to_upload(original_count: int, uploaded_count: int) -> None:
    """Checks if any files are left to upload and exits if not."""
    if uploaded_count > 0:
        return

    if original_count > 0:
        typer.echo(
            typer.style("All paths were skipped. No files to upload.", fg=typer.colors.RED),
            err=True,
        )
    else:
        typer.echo(typer.style("No files provided to upload.", fg=typer.colors.RED), err=True)
    raise typer.Exit(code=1)


@upload_typer.callback()
def upload(
    files: List[str] = typer.Argument(
        help="files, directories (with --recursive) or quoted glob patterns such as '**/*.mcap'"
    ),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    create: bool = typer.Option(False, help="create mission if it does not exist"),
    metadata: Optional[str] = typer.Option(None, help="path to metadata file (json or yaml)"),
    fix_filenames: bool = typer.Option(
        False,
        help="fix filenames before upload, this does not change the filenames locally",
    ),
    skip: bool = typer.Option(
        False,
        "--skip",
        "-s",
        help="skip unsupported file types, badly named files, or directories instead of erroring",
    ),
    recursive: bool = typer.Option(
        False,
        "--recursive",
        "-r",
        help="include all supported files in the given directories and their subdirectories",
    ),
    experimental_datatypes: bool = typer.Option(False, help="allow experimental datatypes (yaml, svo2, db3, tum)"),
    ignore_missing_metadata: bool = typer.Option(False, help="ignore missing required metadata"),
    ignore_missing_tags: Optional[bool] = typer.Option(None, "--ignore-missing-tags/--no-ignore-missing-tags", hidden=True),
) -> None:
    if ignore_missing_tags is not None:
        warn_deprecated(
            "--ignore-missing-tags/--no-ignore-missing-tags", "--ignore-missing-metadata/--no-ignore-missing-metadata"
        )
        ignore_missing_metadata = ignore_missing_tags

    original_file_paths = expand_file_args(
        files, recursive=recursive, suffixes=supported_suffixes(experimental_datatypes=experimental_datatypes)
    )
    mission_query = _build_mission_query(mission, project)

    validator = FileValidator(
        skip=skip,
        experimental_datatypes=experimental_datatypes,
        fix_filenames=fix_filenames,
    )

    # This function will raise an error if skip=False and a file is invalid
    files_to_upload = validator.filter_files(original_file_paths)

    _report_skipped_files(validator.skipped_files)

    _handle_no_files_to_upload(original_count=len(original_file_paths), uploaded_count=len(files_to_upload))

    verbose = get_shared_state().verbose

    try:
        if verbose:
            with transfer_progress("Uploading files", total=len(files_to_upload)) as cbs:
                result, interrupted = run_interruptible(
                    lambda: kleinkram.core.upload(
                        client=AuthenticatedClient(),
                        query=mission_query,
                        file_paths=files_to_upload,
                        create=create,
                        fix_filenames=fix_filenames,
                        metadata=load_metadata(Path(metadata)) if metadata else None,
                        ignore_missing_metadata=ignore_missing_metadata,
                        on_overall_progress_cb=cbs.on_overall_progress,
                        on_file_start_cb=cbs.on_file_start,
                        on_file_progress_cb=cbs.on_file_progress,
                        on_message_cb=cbs.on_message,
                    )
                )

            # Print summary after progress context closes
            avg_speed = result.total_bytes / result.elapsed_seconds if result.elapsed_seconds > 0 else 0
            typer.echo(f"\nUpload took {result.elapsed_seconds:.2f} seconds")
            typer.echo(f"Total uploaded: {format_bytes(result.total_bytes)}")
            typer.echo(f"Average speed: {format_bytes(avg_speed, speed=True)}")
            if result.failed > 0 or result.canceled > 0:
                parts = [f"Uploaded {result.uploaded} files"]
                if result.skipped > 0:
                    parts.append(f"{result.skipped} skipped")
                if result.canceled > 0:
                    parts.append(f"{result.canceled} canceled")
                if result.failed > 0:
                    parts.append(f"{result.failed} failed")
                typer.echo(
                    typer.style(
                        f"\n{', '.join(parts)}",
                        fg=typer.colors.YELLOW if result.failed == 0 else typer.colors.RED,
                    ),
                    err=True,
                )
            else:
                parts = [f"Uploaded {result.uploaded} files"]
                if result.skipped > 0:
                    parts.append(f"{result.skipped} skipped")
                typer.echo(f"\n{', '.join(parts)}")
        else:
            # No verbose: no progress bars, no callbacks
            result, interrupted = run_interruptible(
                lambda: kleinkram.core.upload(
                    client=AuthenticatedClient(),
                    query=mission_query,
                    file_paths=files_to_upload,
                    create=create,
                    fix_filenames=fix_filenames,
                    metadata=load_metadata(Path(metadata)) if metadata else None,
                    ignore_missing_metadata=ignore_missing_metadata,
                )
            )
            if result.failed > 0 or result.canceled > 0:
                parts = [f"Uploaded {result.uploaded} file(s)"]
                if result.skipped > 0:
                    parts.append(f"{result.skipped} skipped")
                if result.canceled > 0:
                    parts.append(f"{result.canceled} canceled")
                if result.failed > 0:
                    parts.append(f"{result.failed} failed")
                typer.echo(
                    typer.style(
                        f"\n{', '.join(parts)}.",
                        fg=typer.colors.YELLOW if result.failed == 0 else typer.colors.RED,
                    ),
                    err=True,
                )
            else:
                parts = [f"Uploaded {result.uploaded} file(s)"]
                if result.skipped > 0:
                    parts.append(f"{result.skipped} skipped")
                typer.echo(
                    typer.style(
                        f"\n{', '.join(parts)}.",
                        fg=typer.colors.GREEN,
                    )
                )

    except MissionNotFound:
        if create:
            raise  # dont change the error message
        raise MissionNotFound("Mission not found. Use `--create` to create it.")

    else:
        if interrupted:
            raise typer.Exit(code=130)  # 128 + SIGINT, the shell convention for Ctrl+C
