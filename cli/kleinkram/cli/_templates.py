from __future__ import annotations

import typer

import kleinkram.api.routes
from kleinkram.api.client import AuthenticatedClient
from kleinkram.config import get_shared_state
from kleinkram.printing import print_templates_table

HELP = """\
Manage action templates.

You can list available action templates to launch new executions.
"""

templates_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "Lists action templates (definitions). To list individual executions, use `klein executions list`."


@templates_typer.command(help=LIST_HELP, name="list")
def list_templates() -> None:
    client = AuthenticatedClient()
    templates = list(kleinkram.api.routes.get_templates(client))

    if not templates:
        typer.echo("No action templates found.")
        return

    print_templates_table(templates, pprint=get_shared_state().verbose)
