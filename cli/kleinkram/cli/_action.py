from __future__ import annotations

import json
import logging
import sys
from typing import Any
from typing import Dict
from typing import Optional

import typer

import kleinkram.core
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_running_action_uuid
from kleinkram.errors import NotInsideAction
from kleinkram.utils import parse_uuid_like

logger = logging.getLogger(__name__)

HELP = """\
Report on the action you are running inside.

These commands only work from within a Kleinkram action container, where Kleinkram
provides the credentials and the action id through environment variables. Use them to
tell the reader of the action what it found, instead of encoding it in the exit code.

A warning does not fail the action: the run still completes, and is shown as done with
warnings.
"""

action_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

WARN_HELP = "Raise a warning on the running action."
FAIL_HELP = "Report an error on the running action (does not stop it)."
INFO_HELP = "Record a note on the running action without changing its verdict."


def _parse_details(details: Optional[str]) -> Optional[Dict[str, Any]]:
    if details is None:
        return None
    try:
        parsed = json.loads(details)
    except json.JSONDecodeError as e:
        raise typer.BadParameter(f"--details must be valid JSON: {e}")
    if not isinstance(parsed, dict):
        raise typer.BadParameter("--details must be a JSON object.")
    return parsed


def _report(
    severity: str,
    message: str,
    code: Optional[str],
    file: Optional[str],
    details: Optional[str],
) -> None:
    """
    Sends one diagnostic, and never lets a reporting failure fail the action.

    Whatever happens here, the action itself is what the user asked us to run. A
    network blip while reporting a warning must not turn a passing run into a failing
    one, so transport errors are written to stderr and swallowed.
    """
    action_uuid = get_running_action_uuid()
    if action_uuid is None:
        raise NotInsideAction("`klein action` commands only work inside a running Kleinkram action.")

    parsed_details = _parse_details(details)

    try:
        kleinkram.core.report_diagnostic(
            client=AuthenticatedClient(),
            execution_id=parse_uuid_like(action_uuid),
            severity=severity,
            message=message,
            code=code,
            file=file,
            details=parsed_details,
        )
    except Exception as e:
        logger.debug("failed to report diagnostic", exc_info=True)
        print(f"kleinkram: could not report {severity.lower()}: {e}", file=sys.stderr)
        return

    typer.secho(f"{severity}: {message}", fg=typer.colors.YELLOW, err=True)


@action_typer.command(name="warn", help=WARN_HELP)
def warn(
    message: str = typer.Argument(..., help="What the reader of this action needs to know."),
    code: Optional[str] = typer.Option(None, "--code", help="Stable code used to group repeated findings, e.g. MISSING_TF."),
    file: Optional[str] = typer.Option(None, "--file", help="The file, path or topic this warning is about."),
    details: Optional[str] = typer.Option(None, "--details", help="Additional context as a JSON object."),
) -> None:
    """
    Raise a warning on the action this container is running.
    """
    _report("WARNING", message, code, file, details)


@action_typer.command(name="fail", help=FAIL_HELP)
def fail(
    message: str = typer.Argument(..., help="What went wrong."),
    code: Optional[str] = typer.Option(None, "--code", help="Stable code used to group repeated findings."),
    file: Optional[str] = typer.Option(None, "--file", help="The file, path or topic this error is about."),
    details: Optional[str] = typer.Option(None, "--details", help="Additional context as a JSON object."),
) -> None:
    """
    Report an error on the action this container is running.

    This records the finding; it does not stop the action. Exit with a non-zero code to
    make the action itself fail.
    """
    _report("ERROR", message, code, file, details)


@action_typer.command(name="info", help=INFO_HELP)
def info(
    message: str = typer.Argument(..., help="The note to record."),
    code: Optional[str] = typer.Option(None, "--code", help="Stable code used to group repeated notes."),
    file: Optional[str] = typer.Option(None, "--file", help="The file, path or topic this note is about."),
    details: Optional[str] = typer.Option(None, "--details", help="Additional context as a JSON object."),
) -> None:
    """
    Record a note on the action without changing how the action is reported.
    """
    _report("INFO", message, code, file, details)
