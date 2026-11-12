"""\
exit codes of `klein upload`, `klein download` and `klein verify`

Like cp, rsync, gsutil or `sha256sum -c`: every file is processed, each
problem is reported on stderr, and the exit code says whether everything
that was asked for happened. `--verbose` / `--no-verbose` only change how
much is printed, never the exit code. Usage errors exit with 2 (Click).
"""

from __future__ import annotations

import typer

# every requested file was handled (identical files already in place count as handled)
EXIT_OK = 0
# at least one requested file was not uploaded / downloaded / verified
EXIT_INCOMPLETE = 1
# Ctrl+C: 128 + SIGINT, the shell convention
EXIT_INTERRUPTED = 130


def print_errors_only(message: str, is_error: bool) -> None:
    """\
    message callback for `--no-verbose`: no progress, no success lines, but
    every problem still gets a line on stderr (like `rsync -q` or `cp`)
    """
    if is_error:
        typer.echo(message, err=True)
