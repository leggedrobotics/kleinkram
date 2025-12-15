from __future__ import annotations

import time
from typing import Optional
from uuid import UUID

import httpx
import typer

import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.config import get_shared_state
from kleinkram.printing import print_action_templates_table
from kleinkram.printing import print_run_info
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import split_args

HELP = """\
Launch kleinkram actions from predefined templates.

You can list available action templates, launch new actions on specific missions, and optionally
follow their logs in real-time.
"""

action_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "Lists action templates (definitions). To list individual runs, use `klein run list`."
GET_HELP = "Get details for a specific action template."
RUN_HELP = "Launch a new action from a template."


@action_typer.command(help=LIST_HELP, name="list")
def list_actions() -> None:
    client = AuthenticatedClient()
    templates = list(kleinkram.api.routes.get_action_templates(client))

    if not templates:
        typer.echo("No action templates found.")
        return

    print_action_templates_table(templates, pprint=get_shared_state().verbose)


@action_typer.command(help=RUN_HELP)
def run(
    template_name: str = typer.Argument(..., help="Name or ID of the template to run."),
    mission: str = typer.Option(..., "--mission", "-m", help="Mission ID or name to run the action on."),
    project: Optional[str] = typer.Option(None, "--project", "-p", help="Project ID or name (to scope mission)."),
    follow: bool = typer.Option(False, "--follow", "-f", help="Follow the logs of the action run."),
) -> None:
    """
    Submits an action to run on a specific mission and optionally follows its logs.
    """
    client = AuthenticatedClient()
    pprint = get_shared_state().verbose

    try:
        project_ids, project_patterns = split_args([project] if project else [])
        project_query = ProjectQuery(ids=project_ids, patterns=project_patterns)

        mission_ids, mission_patterns = split_args([mission])
        mission_query = MissionQuery(
            ids=mission_ids,
            patterns=mission_patterns,
            project_query=project_query,
        )
        mission_obj = kleinkram.api.routes.get_mission(client, mission_query)
        mission_uuid = mission_obj.id
    except kleinkram.errors.MissionNotFound:
        typer.secho(f"Error: Mission '{mission}' not found.", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    except kleinkram.errors.InvalidMissionQuery:
        typer.secho(
            "Error: Mission query is ambiguous. Try specifying a project with -p.",
            fg=typer.colors.RED,
        )
        raise typer.Exit(code=1)
    except Exception as e:
        typer.secho(f"Error resolving mission: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    # 2. Resolve Template to UUID
    try:
        if is_valid_uuid4(template_name):
            template_uuid = UUID(template_name)
        else:
            templates = kleinkram.api.routes.get_action_templates(client)
            found_template = next((t for t in templates if t.name == template_name), None)

            if not found_template:
                typer.secho(
                    f"Error: Action template '{template_name}' not found.",
                    fg=typer.colors.RED,
                )
                raise typer.Exit(code=1)
            template_uuid = found_template.uuid
    except Exception as e:
        typer.secho(f"Error resolving template: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    try:
        action_uuid_str = kleinkram.api.routes.submit_action(client, mission_uuid, template_uuid)
        typer.secho(f"Action submitted. Run ID: {action_uuid_str}", fg=typer.colors.GREEN)

    except httpx.HTTPStatusError as e:
        typer.secho(f"Error submitting action: {e.response.text}", fg=typer.colors.RED)
        raise typer.Exit(code=1)
    except (KeyError, Exception) as e:
        typer.secho(f"An unexpected error occurred: {e}", fg=typer.colors.RED)
        raise typer.Exit(code=1)

    if follow:
        exit_code = kleinkram.printing.follow_run_logs(client, action_uuid_str)
        if exit_code != 0:
            raise typer.Exit(code=exit_code)

    elif pprint:
        # Not following, but in verbose mode. Show run info.
        try:
            time.sleep(0.5)  # Give API a moment
            run_details = kleinkram.api.routes.get_run(client, action_uuid_str)
            kleinkram.printing.print_run_info(run_details, pprint=True)
        except Exception:
            # Non-critical, we already printed the ID.
            pass
