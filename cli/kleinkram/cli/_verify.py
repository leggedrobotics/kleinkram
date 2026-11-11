from __future__ import annotations

import logging
from typing import List
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.cli._context import OPTIONS_ANYWHERE
from kleinkram.cli._deprecation import warn_deprecated
from kleinkram.cli._exit_codes import EXIT_INCOMPLETE
from kleinkram.cli._file_expansion import expand_file_args
from kleinkram.cli._file_validator import FileValidator
from kleinkram.cli._file_validator import _report_skipped_files
from kleinkram.cli._file_validator import supported_suffixes
from kleinkram.cli._upload import _build_mission_query
from kleinkram.config import get_shared_state
from kleinkram.models import FileVerificationStatus
from kleinkram.printing import print_file_verification_status

logger = logging.getLogger(__name__)

HELP = """\
Verify if files were uploaded correctly.
"""

verify_typer = typer.Typer(
    name="verify",
    no_args_is_help=True,
    invoke_without_command=True,
    help=HELP,
    context_settings=OPTIONS_ANYWHERE,
)


def _handle_no_files_to_process(original_count: int, processed_count: int, action: str = "verify") -> None:
    """Checks if any files are left and exits if not."""
    if processed_count > 0:
        return

    if original_count > 0:
        typer.echo(
            typer.style(f"All paths were skipped. No files to {action}.", fg=typer.colors.RED),
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
    files: List[str] = typer.Argument(
        help="files, directories (with --recursive) or quoted glob patterns such as '**/*.mcap'"
    ),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="project id or name"),
    mission: str = typer.Option(..., "--mission", "-m", help="mission id or name"),
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
    check_file_hash: bool = typer.Option(
        True,
        help="check file hash. If True, file names and file hashes are checked.",
    ),
    check_file_size: bool = typer.Option(
        True,
        help="check file size. If True, file names and file sizes are checked.",
    ),
    skip_hash: Optional[bool] = typer.Option(None, hidden=True),
) -> None:
    if skip_hash is not None:
        warn_deprecated("--skip-hash/--no-skip-hash", "--no-check-file-hash/--check-file-hash")
        check_file_hash = not skip_hash

    # get all filepaths
    original_file_paths = expand_file_args(
        files, recursive=recursive, suffixes=supported_suffixes(experimental_datatypes=experimental_datatypes)
    )

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
        check_file_hash=check_file_hash,
        check_file_size=check_file_size,
        verbose=verbose,
    )
    print_file_verification_status(file_status, pprint=verbose)

    # like `sha256sum -c`: exit with 1 unless every file is confirmed in the mission
    not_verified = [s for s in file_status.values() if s != FileVerificationStatus.UPLOADED]
    if not_verified:
        pending = sum(s in (FileVerificationStatus.UPLOADING, FileVerificationStatus.COMPUTING_HASH) for s in not_verified)
        message = f"{len(not_verified)} of {len(file_status)} file(s) could not be verified."
        if pending:
            message += f" {pending} of them are still being processed, run `klein verify` again later."
        typer.echo(typer.style(message, fg=typer.colors.RED), err=True)
        raise typer.Exit(code=EXIT_INCOMPLETE)
