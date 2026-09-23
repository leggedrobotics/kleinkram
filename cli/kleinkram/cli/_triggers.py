from __future__ import annotations

from typing import Annotated
from typing import Any
from typing import Optional
from uuid import UUID

import typer

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
import kleinkram.models
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.query import TriggerQuery
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import require
from kleinkram.config import get_shared_state
from kleinkram.models import FileConfig
from kleinkram.models import FileTriggerEvent
from kleinkram.models import TimeConfig
from kleinkram.models import TriggerConfig
from kleinkram.models import TriggerType
from kleinkram.models import WebhookConfig
from kleinkram.printing import print_trigger_info
from kleinkram.printing import print_triggers_table
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import split_args

HELP = """\
Manage action triggers.

You can list available action triggers, update them, delete them, or
create new ones. Action triggers are used to automatically launch
action executions based on certain conditions.
"""


trigger_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "Lists action triggers and optionally filter by mission."
INFO_HELP = "Shows detailed information about an action trigger."
CREATE_HELP = "Creates a new action trigger."
UPDATE_HELP = "Updates an existing action trigger. Only the provided fields will be updated."
DELETE_HELP = "Deletes an action trigger."

TRIGGER_ARG_HELP = "Trigger UUID"
TYPE_HELP = "Type of the trigger (e.g., FILE, TIME, WEBHOOK)"
FILE_PATTERNS_HELP = (
    "File patterns, provide multiples via '--file-patterns *.bag --file-patterns date.bag' (only for FILE triggers)"
)
FILE_EVENTS_HELP = "File events, provide multiples via '--file-events UPLOAD --file-events DELETE' (only for FILE triggers)"
CRON_HELP = "Cron expression (only for TIME triggers)"
DEPRECATED_TYPE_FLAG = "-y for --type"


def _parse_trigger_uuid(trigger: str) -> UUID:
    if not is_valid_uuid4(trigger):
        raise typer.BadParameter(f"'{trigger}' is not a valid UUID.")
    return parse_uuid_like(trigger)


def _resolve_mission(client: AuthenticatedClient, mission: str, project: Optional[str]) -> UUID:
    mission_ids, mission_patterns = split_args([mission])
    project_ids, project_patterns = split_args([project] if project else [])
    query = MissionQuery(
        ids=mission_ids,
        patterns=mission_patterns,
        project_query=ProjectQuery(ids=project_ids, patterns=project_patterns),
    )
    return kleinkram.api.routes.get_mission(client, query).id


def _build_config(
    type_: TriggerType,
    file_patterns: Optional[list[str]],
    file_events: Optional[list[FileTriggerEvent]],
    cron_expression: Optional[str],
) -> TriggerConfig:
    match type_:
        case TriggerType.FILE:
            if not file_patterns:
                raise typer.BadParameter("At least one --file-patterns is required for FILE triggers.")
            event = tuple(file_events) if file_events is not None else ()
            return FileConfig(patterns=tuple(file_patterns), event=event)
        case TriggerType.TIME:
            if cron_expression is None:
                raise typer.BadParameter("--cron option is required for TIME triggers.")
            return TimeConfig(cron=cron_expression)
        case TriggerType.WEBHOOK:
            return WebhookConfig()
        case _:
            raise typer.BadParameter(f"Unsupported trigger type '{type_}'.")


@trigger_typer.command(help=LIST_HELP, name="list")
def list_triggers_cli(
    mission: Annotated[Optional[str], typer.Option("--mission", "-m", help="Filter by mission ID or name")] = None,
    project: Annotated[
        Optional[str], typer.Option("--project", "-p", help="Project ID or name (to scope the mission)")
    ] = None,
) -> None:
    client = AuthenticatedClient()

    query = TriggerQuery()
    if mission is not None:
        query.mission_uuid = _resolve_mission(client, mission, project)

    triggers = kleinkram.api.routes.get_triggers(client=client, query=query)

    if not triggers:
        typer.secho("No action triggers found.", fg=typer.colors.GREEN)
        return

    print_triggers_table(triggers, pprint=get_shared_state().verbose)


@trigger_typer.command(help=INFO_HELP, name="info")
def trigger_info_cli(trigger: str = typer.Argument(..., metavar="TRIGGER_UUID", help=TRIGGER_ARG_HELP)) -> None:
    trigger_uuid = _parse_trigger_uuid(trigger)

    client = AuthenticatedClient()
    trigger_parsed = kleinkram.api.routes.get_trigger(client=client, trigger_uuid=trigger_uuid)

    print_trigger_info(trigger_parsed, pprint=get_shared_state().verbose)


@trigger_typer.command(help=CREATE_HELP, name="create", cls=CompatCommand)
def create_trigger_cli(
    trigger_name: Annotated[Optional[str], typer.Argument(metavar="NAME", help="Name of the trigger")] = None,
    template: Annotated[
        Optional[str], typer.Option("--template", "-t", help="Template ID or name to launch (required)")
    ] = None,
    mission: Annotated[
        Optional[str], typer.Option("--mission", "-m", help="Mission ID or name to associate the trigger with (required)")
    ] = None,
    project: Annotated[
        Optional[str], typer.Option("--project", "-p", help="Project ID or name (to scope the mission)")
    ] = None,
    type_: Annotated[Optional[TriggerType], typer.Option("--type", help=f"{TYPE_HELP} (required)")] = None,
    description: Annotated[str, typer.Option("--description", "-d", help="Description of the trigger")] = "",
    file_patterns: Annotated[Optional[list[str]], typer.Option("--file-patterns", help=FILE_PATTERNS_HELP)] = None,
    file_events: Annotated[Optional[list[FileTriggerEvent]], typer.Option("--file-events", help=FILE_EVENTS_HELP)] = None,
    cron_expression: Annotated[Optional[str], typer.Option("--cron", help=CRON_HELP)] = None,
    name_flag: Annotated[Optional[str], typer.Option("--name", "-n", hidden=True)] = None,
    type_flag: Annotated[Optional[TriggerType], typer.Option("-y", hidden=True)] = None,
) -> None:
    trigger_name = require(prefer_new(trigger_name, name_flag, old="--name/-n", new="the positional NAME argument"), "NAME")
    type_ = require(prefer_new(type_, type_flag, old=DEPRECATED_TYPE_FLAG, new="--type"), "--type")
    template = require(template, "--template")
    mission = require(mission, "--mission")

    config = _build_config(type_, file_patterns, file_events, cron_expression)

    client = AuthenticatedClient()
    trigger_uuid = kleinkram.core.create_trigger(
        client=client,
        trigger_name=trigger_name,
        description=description,
        template_uuid=kleinkram.core.resolve_template(client, template),
        mission_uuid=_resolve_mission(client, mission, project),
        type_=type_,
        config=config,
    )
    typer.secho(f"Trigger '{trigger_name}' created successfully with UUID {trigger_uuid}.", fg=typer.colors.GREEN)


@trigger_typer.command(help=UPDATE_HELP, name="update")
def update_trigger_cli(
    trigger: Annotated[str, typer.Argument(..., metavar="TRIGGER_UUID", help=TRIGGER_ARG_HELP)],
    trigger_name: Annotated[Optional[str], typer.Option("--name", "-n", help="New name of the trigger")] = None,
    description: Annotated[Optional[str], typer.Option("--description", "-d", help="Description of the trigger")] = None,
    template: Annotated[Optional[str], typer.Option("--template", "-t", help="Template ID or name to launch")] = None,
    mission: Annotated[
        Optional[str], typer.Option("--mission", "-m", help="Mission ID or name to associate the trigger with")
    ] = None,
    project: Annotated[
        Optional[str], typer.Option("--project", "-p", help="Project ID or name (to scope the mission)")
    ] = None,
    type_: Annotated[Optional[TriggerType], typer.Option("--type", help=TYPE_HELP)] = None,
    file_patterns: Annotated[Optional[list[str]], typer.Option("--file-patterns", help=FILE_PATTERNS_HELP)] = None,
    file_events: Annotated[Optional[list[FileTriggerEvent]], typer.Option("--file-events", help=FILE_EVENTS_HELP)] = None,
    cron_expression: Annotated[Optional[str], typer.Option("--cron", help=CRON_HELP)] = None,
    type_flag: Annotated[Optional[TriggerType], typer.Option("-y", hidden=True)] = None,
) -> None:
    trigger_uuid = _parse_trigger_uuid(trigger)
    type_ = prefer_new(type_, type_flag, old=DEPRECATED_TYPE_FLAG, new="--type")

    client = AuthenticatedClient()

    updated_fields: dict[str, Any] = {}
    if trigger_name is not None:
        updated_fields["trigger_name"] = trigger_name
    if description is not None:
        updated_fields["description"] = description
    if template is not None:
        updated_fields["template_uuid"] = kleinkram.core.resolve_template(client, template)
    if mission is not None:
        updated_fields["mission_uuid"] = _resolve_mission(client, mission, project)
    if type_ is not None:
        updated_fields["type_"] = type_
        updated_fields["config"] = _build_config(type_, file_patterns, file_events, cron_expression)
    elif any(v is not None for v in [file_patterns, file_events, cron_expression]):
        raise typer.BadParameter("Trigger type must be specified when updating config fields. Please provide --type option.")

    if not updated_fields:
        typer.secho("No fields to update. Please provide at least one field to update.", fg=typer.colors.GREEN)
        raise typer.Exit(code=0)

    kleinkram.core.update_trigger(client=client, trigger_uuid=trigger_uuid, **updated_fields)
    typer.secho(f"Trigger '{trigger_uuid}' updated successfully.", fg=typer.colors.GREEN)


@trigger_typer.command(help=DELETE_HELP, name="delete")
def delete_trigger_cli(
    trigger: str = typer.Argument(..., metavar="TRIGGER_UUID", help=TRIGGER_ARG_HELP),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
) -> None:
    trigger_uuid = _parse_trigger_uuid(trigger)
    confirm_deletion(f"delete trigger {trigger_uuid}", yes=yes, legacy_no_prompt=True)

    client = AuthenticatedClient()
    kleinkram.core.delete_trigger(client=client, trigger_uuid=trigger_uuid)
    typer.secho(f"Trigger '{trigger_uuid}' deleted successfully.", fg=typer.colors.GREEN)
