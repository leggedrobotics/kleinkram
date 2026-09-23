from __future__ import annotations

from typing import Annotated
from typing import Any
from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
import kleinkram.models
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import TriggerQuery
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

HELP = """\
Manage action triggers.

You can list available action triggers, update them, delete them, or
create new ones. Action triggers are used to automatically launch
action executions based on certain conditions.
"""


triggers_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "Lists action triggers and optionally filter by mission UUID."
INFO_HELP = "Shows detailed information about an action trigger."
CREATE_HELP = "Creates a new action trigger."
UPDATE_HELP = "Updates an existing action trigger. Only the provided fields will be updated."
DELETE_HELP = "Deletes an action trigger."


@triggers_typer.command(help=LIST_HELP, name="list")
def list_triggers_cli(
    mission_uuid: Optional[str] = typer.Option(None, "--mission", "-m", help="Filter by mission UUID")
) -> None:
    client = AuthenticatedClient()

    query = TriggerQuery()

    if mission_uuid is not None:
        if not is_valid_uuid4(mission_uuid):
            raise typer.BadParameter(f"'{mission_uuid}' is not a valid UUID.")
        else:
            query.mission_uuid = parse_uuid_like(mission_uuid)

    triggers = kleinkram.api.routes.get_triggers(client=client, query=query)

    if not triggers:
        typer.secho("No action triggers found.", fg=typer.colors.GREEN)
        return

    print_triggers_table(triggers, pprint=get_shared_state().verbose)


@triggers_typer.command(help=INFO_HELP, name="info")
def trigger_info_cli(trigger_uuid: str = typer.Argument(..., metavar="TRIGGER_UUID", help="Trigger UUID")) -> None:
    client = AuthenticatedClient()

    if not is_valid_uuid4(trigger_uuid):
        raise typer.BadParameter(f"'{trigger_uuid}' is not a valid UUID.")

    trigger = kleinkram.api.routes.get_trigger(client=client, trigger_uuid=parse_uuid_like(trigger_uuid))

    print_trigger_info(trigger, pprint=get_shared_state().verbose)


@triggers_typer.command(help=CREATE_HELP, name="create")
def create_trigger_cli(
    trigger_name: Annotated[str, typer.Option("--name", "-n", help="Name of the trigger")],
    template_uuid: Annotated[str, typer.Option("--template", "-t", help="Template UUID to launch")],
    mission_uuid: Annotated[str, typer.Option("--mission", "-m", help="Mission UUID to associate the trigger with")],
    type_: Annotated[TriggerType, typer.Option("--type", "-y", help="Type of the trigger (e.g., FILE, TIME, WEBHOOK)")],
    description: Annotated[str, typer.Option("--description", "-d", help="Description of the trigger")] = "",
    file_patterns: Annotated[
        Optional[list[str]],
        typer.Option(
            "--file-patterns",
            help="File patterns, provide multiples via '--file-patterns *.bag"
            " --file-patters date.bag' (only for FILE triggers)",
        ),
    ] = None,
    file_events: Annotated[
        Optional[list[FileTriggerEvent]],
        typer.Option(
            "--file-events",
            help="File events, provide multiples via '--file-events UPLOAD --file-events DELETE' (only for FILE triggers)",
        ),
    ] = None,
    cron_expression: Annotated[Optional[str], typer.Option("--cron", help="Cron expression (only for TIME triggers)")] = None,
) -> None:
    client = AuthenticatedClient()

    config: TriggerConfig
    match type_:
        case TriggerType.FILE:
            if not file_patterns:
                raise typer.BadParameter("At least one --file-pattern is required for FILE triggers.")
            event = tuple(file_events) if file_events is not None else ()
            config = FileConfig(patterns=tuple(file_patterns), event=event)
        case TriggerType.TIME:
            if cron_expression is None:
                raise typer.BadParameter("--cron option is required for TIME triggers.")
            config = TimeConfig(cron=cron_expression)
        case TriggerType.WEBHOOK:
            config = WebhookConfig()
        case _:
            raise typer.BadParameter(f"Unsupported trigger type '{type_}'.")

    trigger_uuid = kleinkram.core.create_trigger(
        client=client,
        trigger_name=trigger_name,
        description=description,
        template_uuid=parse_uuid_like(template_uuid),
        mission_uuid=parse_uuid_like(mission_uuid),
        type_=type_,
        config=config,
    )
    typer.secho(f"Trigger '{trigger_name}' created successfully with UUID {trigger_uuid}.", fg=typer.colors.GREEN)


@triggers_typer.command(help=UPDATE_HELP, name="update")
def update_trigger_cli(
    trigger_uuid: Annotated[str, typer.Argument(..., metavar="TRIGGER_UUID", help="Trigger UUID")],
    trigger_name: Annotated[Optional[str], typer.Option("--name", "-n", help="Name of the trigger")] = None,
    description: Annotated[Optional[str], typer.Option("--description", "-d", help="Description of the trigger")] = None,
    template_uuid: Annotated[Optional[str], typer.Option("--template", "-t", help="Template UUID to launch")] = None,
    mission_uuid: Annotated[
        Optional[str], typer.Option("--mission", "-m", help="Mission UUID to associate the trigger with")
    ] = None,
    type_: Annotated[
        Optional[TriggerType], typer.Option("--type", "-y", help="Type of the trigger (e.g., FILE, TIME, WEBHOOK)")
    ] = None,
    file_patterns: Annotated[
        Optional[list[str]],
        typer.Option(
            "--file-patterns",
            help="File patterns, provide multiples via '--file-patterns *.bag "
            "--file-patterns date.bag' (only for FILE triggers)",
        ),
    ] = None,
    file_events: Annotated[
        Optional[list[FileTriggerEvent]],
        typer.Option(
            "--file-events",
            help="File events, provide multiples via '--file-events UPLOAD --file-events DELETE' (only for FILE triggers)",
        ),
    ] = None,
    cron_expression: Annotated[Optional[str], typer.Option("--cron", help="Cron expression (only for TIME triggers)")] = None,
) -> None:
    client = AuthenticatedClient()

    updated_fields: dict[str, Any] = {}
    if trigger_name is not None:
        updated_fields["trigger_name"] = trigger_name
    if description is not None:
        updated_fields["description"] = description
    if template_uuid is not None:
        updated_fields["template_uuid"] = parse_uuid_like(template_uuid)
    if mission_uuid is not None:
        updated_fields["mission_uuid"] = parse_uuid_like(mission_uuid)
    if type_ is not None:
        updated_fields["type_"] = type_
        match type_:
            case TriggerType.FILE:
                if file_patterns is None:
                    raise typer.BadParameter("At least one --file-pattern is required for FILE triggers.")
                event = tuple(file_events) if file_events is not None else ()
                updated_fields["config"] = FileConfig(patterns=tuple(file_patterns), event=event)
            case TriggerType.TIME:
                if cron_expression is None:
                    raise typer.BadParameter("--cron option is required for TIME triggers.")
                updated_fields["config"] = TimeConfig(cron=cron_expression)
            case TriggerType.WEBHOOK:
                updated_fields["config"] = WebhookConfig()
    elif any(v is not None for v in [file_patterns, file_events, cron_expression]):
        raise typer.BadParameter("Trigger type must be specified when updating config fields. Please provide --type option.")

    if not updated_fields:
        typer.secho("No fields to update. Please provide at least one field to update.", fg=typer.colors.GREEN)
        raise typer.Exit(code=0)

    kleinkram.core.update_trigger(client=client, trigger_uuid=parse_uuid_like(trigger_uuid), **updated_fields)
    typer.secho(f"Trigger '{trigger_uuid}' updated successfully.", fg=typer.colors.GREEN)


@triggers_typer.command(help=DELETE_HELP, name="delete")
def delete_trigger_cli(trigger_uuid: str = typer.Argument(..., metavar="TRIGGER_UUID", help="Trigger UUID")) -> None:
    client = AuthenticatedClient()

    kleinkram.core.delete_trigger(client=client, trigger_uuid=parse_uuid_like(trigger_uuid))
    typer.secho(f"Trigger '{trigger_uuid}' deleted successfully.", fg=typer.colors.GREEN)
