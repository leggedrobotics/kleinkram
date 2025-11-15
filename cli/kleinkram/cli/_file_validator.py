from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List

import typer

from kleinkram.config import get_shared_state
from kleinkram.errors import DatatypeNotSupported
from kleinkram.errors import FileNameNotSupported
from kleinkram.utils import (
    check_filename_is_sanatized,
    EXPERIMENTAL_FILE_TYPES,
    SUPPORT_FILE_TYPES,
)


@dataclass
class FileValidator:
    """Encapsulates all file validation logic based on CLI flags."""

    skip: bool
    experimental_datatypes: bool

    # Stores (file, reason) for skipped files
    skipped_files: List[tuple[Path, str]] = field(default_factory=list)

    def filter_files(self, file_paths: List[Path]) -> List[Path]:
        """
        Validates a list of file paths.

        - Populates `self.skipped_files` with invalid files.
        - Raises an exception on the first invalid file if `self.skip` is False.
        - Returns a list of valid files to verify.
        """
        files_to_verify = []
        for file in file_paths:
            try:
                self._validate_path(file)
                files_to_verify.append(file)
            except (
                FileNotFoundError,
                IsADirectoryError,
                DatatypeNotSupported,
                FileNameNotSupported,
            ) as e:
                if self.skip:
                    self.skipped_files.append((file, str(e)))
                else:
                    # Re-raise the exception to be caught by Typer
                    self._raise_with_skip_hint(e)
        return files_to_verify

    def _validate_path(self, file: Path) -> None:
        """
        Runs a single file through all validation checks.
        Raises an error if any check fails.
        """
        # 0. Check for existence
        if not file.exists():
            raise FileNotFoundError(f"File not found: {file}")

        # 1. Check for directories
        if file.is_dir():
            raise IsADirectoryError(f"{file} is a directory")

        file_suffix = file.suffix.lower()
        is_experimental = file_suffix in EXPERIMENTAL_FILE_TYPES
        is_standard = file_suffix in SUPPORT_FILE_TYPES

        # 2. Check if the datatype is known at all
        if not is_standard and not is_experimental:
            raise DatatypeNotSupported(
                f"Unsupported file type '{file_suffix}' on file {file}"
            )

        # 3. Check if an experimental datatype is allowed
        if is_experimental and not self.experimental_datatypes:
            raise DatatypeNotSupported(
                f"Experimental datatype '{file_suffix}' not enabled for file {file}"
            )

        # 4. Check filename
        is_bad_name = not check_filename_is_sanatized(file.stem)
        if is_bad_name:
            raise FileNameNotSupported(f"Badly formed filename for file {file}")

    def _raise_with_skip_hint(self, e: Exception) -> None:
        """Re-raises a validation error with a hint to use --skip."""
        base_message = str(e)
        hint = "Use --skip to ignore."

        if isinstance(e, IsADirectoryError):
            hint = "Use --skip to ignore directories."
        elif isinstance(e, DatatypeNotSupported):
            if "Experimental" in base_message:
                hint = "Use --experimental-datatypes to allow or --skip to ignore."
        elif isinstance(e, FileNameNotSupported):
            hint = "Use --skip to ignore."  # No --fix-filenames hint here

        # Raise a new exception to the same type to preserve the error type
        raise type(e)(f"{base_message}. {hint}")


def _report_skipped_files(skipped_files: List[tuple[Path, str]]) -> None:
    """Prints a formatted report of all skipped files."""
    if skipped_files:
        debug = get_shared_state().debug

        if debug:
            # Full report
            typer.echo(
                typer.style(
                    f"--- Skipped {len(skipped_files)} path(s) ---",
                    fg=typer.colors.YELLOW,
                )
            )
            for file, reason in skipped_files:
                typer.echo(f"Skipped: {file} (Reason: {reason})")
            typer.echo("---------------------------\n")
        else:
            # Summary report
            typer.echo(
                typer.style(
                    f"Skipped {len(skipped_files)} path(s) due to errors. Use `klein --debug [...]` for details.",
                    fg=typer.colors.YELLOW,
                )
            )
            typer.echo("")
