from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any
from typing import Dict
from typing import Optional
from typing import Tuple

import typer

import kleinkram.core
import kleinkram.errors
import kleinkram.printing
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.config import get_running_action_uuid
from kleinkram.errors import NotInsideAction
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import split_args

logger = logging.getLogger(__name__)

HELP = """\
Run scripts as actions, and report on the action you are running inside.

`run-script` uploads a single Python file and runs it on Kleinkram's shared runner
image, so a quick analysis needs no Dockerfile and no image push. `deps` prints what
that image ships.

The remaining commands only work from within a Kleinkram action container, where
Kleinkram provides the credentials and the action id through environment variables. Use
them to tell the reader of the action what it found, instead of encoding it in the exit
code. A warning does not fail the action: the run still completes, and is shown as done
with warnings.
"""

action_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

RUN_SCRIPT_HELP = "Run a single Python file as an action, without building an image."
DEPS_HELP = "Print the fixed dependency set of the script runner image."
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


# The dependency set baked into the `script-runner` image. Mirrors
# `examples/kleinkram-actions/script-runner/requirements.txt`, which is the
# authoritative list; this copy exists so that `klein action deps` answers
# without a round trip to the server.
RUNNER_DEPENDENCIES: Tuple[Tuple[str, str], ...] = (
    ("kleinkram", "Kleinkram Python SDK and CLI"),
    ("mcap", "reading MCAP files"),
    ("mcap-ros2-support", "decoding ROS 2 messages inside MCAP files"),
    ("rosbags", "reading ROS 1 and ROS 2 bags without a ROS install"),
    ("numpy", "arrays and numerics"),
    ("scipy", "signal processing, interpolation, optimisation"),
    ("pandas", "dataframes and time series"),
    ("matplotlib", "plots written to /out"),
    ("pyyaml", "reading and writing YAML"),
    ("pyarrow", "Parquet and Arrow output"),
    ("transforms3d", "rotations, quaternions and homogeneous transforms"),
    ("pyproj", "geodetic and map projections"),
)


@action_typer.command(name="run-script", help=RUN_SCRIPT_HELP)
def run_script(
    script: Path = typer.Argument(
        ...,
        exists=True,
        dir_okay=False,
        readable=True,
        help="The Python file to run.",
    ),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name (to scope the mission)."),
    mission: str = typer.Option(..., "--mission", "-m", help="Mission ID or name to run the script on."),
    follow: bool = typer.Option(
        True,
        "--follow/--no-follow",
        help="Follow the logs and exit non-zero if the run does not finish cleanly.",
    ),
    timeout: Optional[float] = typer.Option(
        None,
        "--timeout",
        help="Runtime budget in minutes. May only lower what the script runner template allows, never raise it.",
    ),
) -> None:
    """
    Uploads a single Python file and runs it on the shared script runner image.

    Nothing is built and no image is pushed: the file is stored by Kleinkram and
    fetched by the runner, which ships a fixed dependency set (see `klein action deps`).
    """
    if timeout is not None and timeout <= 0:
        raise typer.BadParameter("`--timeout` must be positive.")

    client = AuthenticatedClient()

    project_ids, project_patterns = split_args([project] if project else [])
    mission_ids, mission_patterns = split_args([mission])
    mission_query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=ProjectQuery(ids=project_ids, patterns=project_patterns),
    )

    typer.echo(f"Submitting {script.name}...")
    try:
        execution_uuid = kleinkram.core.run_script(
            client=client,
            mission_query=mission_query,
            script_path=script,
            max_runtime_hours=None if timeout is None else timeout / 60,
        )
    except kleinkram.errors.InvalidMissionQuery as e:
        raise kleinkram.errors.InvalidMissionQuery("Mission query is ambiguous. Try specifying a project with -p.") from e

    typer.secho(f"Script submitted. Execution ID: {execution_uuid}", fg=typer.colors.GREEN)

    if follow:
        exit_code = kleinkram.printing.follow_execution_logs(client, execution_uuid)
        if exit_code != 0:
            raise typer.Exit(code=exit_code)


@action_typer.command(name="deps", help=DEPS_HELP)
def deps() -> None:
    """
    Print what a script submitted with `run-script` may import.

    The set is fixed: a single file cannot bring its own requirements. If your script
    needs something that is not listed, write a Docker action instead.
    """
    typer.echo("Scripts run by `klein action run-script` may import:\n")
    width = max(len(name) for name, _ in RUNNER_DEPENDENCIES)
    for name, purpose in RUNNER_DEPENDENCIES:
        typer.echo(f"  {name.ljust(width)}  {purpose}")
    typer.echo("\nplus the Python 3.11 standard library. The set is fixed; write a Docker action if you need more.")


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
