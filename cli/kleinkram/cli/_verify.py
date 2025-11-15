from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.cli._file_validator import FileValidator, _report_skipped_files
from kleinkram.cli._upload import _build_mission_query
from kleinkram.config import get_shared_state
from kleinkram.printing import print_file_verification_status

logger = logging.getLogger(__name__)

HELP = """\
Verify if files were uploaded correctly.
"""

verify_typer = typer.Typer(name="verify", invoke_without_command=True, help=HELP)


def _handle_no_files_to_process(
    original_count: int, processed_count: int, action: str = "verify"
) -> None:
    """Checks if any files are left and exits if not."""
    if processed_count > 0:
        return

    if original_count > 0:
        typer.echo(
            typer.style(
                f"All paths were skipped. No files to {action}.", fg=typer.colors.RED
            ),
            err=True,
        )
    else:
        typer.echo(
            typer.style(f"No files provided to {action}.", fg=typer.colors.RED),
            err=True,
        )
    raise typer.Exit(code=1)


@verify_typer.callback()
def verify(
    files: List[str] = typer.Argument(help="files to verify"),
    project: Optional[str] = typer.Option(
        None, "--project", "-p", help="project id or name"
    ),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
    skip: bool = typer.Option(
        False,
        "--skip",
        "-s",
        help="skip unsupported file types, badly named files, or directories instead of erroring",
    ),
    experimental_datatypes: bool = typer.Option(
        False, help="allow experimental datatypes (yaml, svo2, db3, tum)"
    ),
    skip_hash: bool = typer.Option(None, help="skip hash check"),
    check_file_hash: bool = typer.Option(
        True,
        help="check file hash. If True, file names and file hashes are checked.",
    ),
    check_file_size: bool = typer.Option(
        True,
        help="check file size. If True, file names and file sizes are checked.",
    ),
) -> None:
    # get all filepaths
    original_file_paths = [Path(file) for file in files]

    # get mission query
    mission_query = _build_mission_query(mission, project)

    validator = FileValidator(
        skip=skip,
        experimental_datatypes=experimental_datatypes,
    )
    files_to_verify = validator.filter_files(original_file_paths)

    # Report skipped files (if any)
    _report_skipped_files(validator.skipped_files)

    # Check if we have anything left to do
    _handle_no_files_to_process(
        original_count=len(original_file_paths),
        processed_count=len(files_to_verify),
        action="verify",
    )

    verbose = get_shared_state().verbose
    file_status = kleinkram.core.verify(
        client=AuthenticatedClient(),
        query=mission_query,
        file_paths=files_to_verify,
        skip_hash=skip_hash,
        check_file_hash=check_file_hash,
        check_file_size=check_file_size,
        verbose=verbose,
    )
    print_file_verification_status(file_status, pprint=verbose)
