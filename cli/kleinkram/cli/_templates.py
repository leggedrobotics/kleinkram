from __future__ import annotations

from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.core
import kleinkram.errors
from kleinkram.api.client import AuthenticatedClient
from kleinkram.cli._deprecation import CompatCommand
from kleinkram.cli._deprecation import confirm_deletion
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli._deprecation import require
from kleinkram.config import get_shared_state
from kleinkram.printing import print_templates_table

HELP = """\
Manage action templates.

You can list available action templates to launch new executions.
"""

template_typer = typer.Typer(
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
    help=HELP,
)

LIST_HELP = "Lists action templates (definitions). To list individual executions, use `klein execution list`."
CREATE_HELP = "Creates a new action template."
REVISIONS_HELP = "Lists revisions/history for a template."
DELETE_HELP = (
    "Deletes an action template. Only the latest version of a"
    " template can be deleted. If the template has existing executions, "
    "it will be archived instead of being deleted."
)
CREATE_VERSION_HELP = "Creates a new version of an existing template."


@template_typer.command(help=LIST_HELP, name="list")
def list_templates_cli(
    all_versions: bool = typer.Option(False, "--all", help="List all versions instead of just the latest"),
) -> None:
    client = AuthenticatedClient()
    templates = kleinkram.core.list_templates(client, latest_only=not all_versions)

    if not templates:
        typer.echo("No action templates found.")
        return

    print_templates_table(templates, pprint=get_shared_state().verbose)


TEMPLATE_ARG_HELP = "template id or name (a name refers to the latest version)"
DEPRECATED_CPU_MEMORY_FLAG = "-m for --cpu-memory"


@template_typer.command(help=REVISIONS_HELP, name="revisions")
def revisions(template: str = typer.Argument(..., metavar="TEMPLATE", help=TEMPLATE_ARG_HELP)) -> None:
    client = AuthenticatedClient()
    template_id = kleinkram.core.resolve_template(client, template)
    revisions = list(kleinkram.api.routes.get_template_revisions(client=client, template_id=template_id))

    print_templates_table(revisions, pprint=get_shared_state().verbose)


@template_typer.command(help=CREATE_VERSION_HELP, name="create-version")
def create_version(
    template: str = typer.Argument(..., metavar="TEMPLATE", help=TEMPLATE_ARG_HELP),
    description: Optional[str] = typer.Option(None, "--description", "-d", help="Template description override"),
    docker_image: Optional[str] = typer.Option(None, "--docker-image", "-i", help="Docker image override"),
    cpu_cores: Optional[int] = typer.Option(None, "--cpu-cores", "-c", help="Number of CPU cores override"),
    cpu_memory_gb: Optional[int] = typer.Option(None, "--cpu-memory", help="CPU memory in GB override"),
    gpu_memory_gb: Optional[int] = typer.Option(None, "--gpu-memory", "-g", help="GPU memory in GB override"),
    max_runtime_minutes: Optional[int] = typer.Option(None, "--max-runtime", "-r", help="Max runtime in minutes override"),
    access_rights: Optional[int] = typer.Option(
        None, "--access-rights", "-a", help="Access rights override (0=READ, 10=CREATE, etc.)"
    ),
    command: Optional[str] = typer.Option(None, "--command", help="Command to run override"),
    entrypoint: Optional[str] = typer.Option(None, "--entrypoint", help="Docker entrypoint override"),
    cpu_memory_flag: Optional[int] = typer.Option(None, "-m", hidden=True),
) -> None:
    cpu_memory_gb = prefer_new(cpu_memory_gb, cpu_memory_flag, old=DEPRECATED_CPU_MEMORY_FLAG, new="--cpu-memory")

    client = AuthenticatedClient()
    template_id = kleinkram.core.resolve_template(client, template)

    template_id = kleinkram.core.create_template_version(
        client=client,
        template_id=template_id,
        description=description,
        docker_image=docker_image,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        gpu_memory_gb=gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes,
        access_rights=access_rights,
        command=command,
        entrypoint=entrypoint,
    )

    typer.secho("Template version successfully created", fg=typer.colors.GREEN)

    template_parsed = kleinkram.api.routes.get_template(client=client, template_id=template_id)
    print_templates_table([template_parsed], pprint=get_shared_state().verbose)


@template_typer.command(help=DELETE_HELP, name="delete")
def delete(
    template: str = typer.Argument(..., metavar="TEMPLATE", help=TEMPLATE_ARG_HELP),
    yes: bool = typer.Option(False, "--yes", "-y", help="delete without asking for confirmation"),
) -> None:
    client = AuthenticatedClient()
    template_id = kleinkram.core.resolve_template(client, template)
    confirm_deletion(f"delete template {template} ({template_id})", yes=yes, legacy_no_prompt=True)

    archived = kleinkram.core.delete_template(client=client, template_id=template_id)
    if archived:
        typer.secho(
            f"Template {template_id} archived (executions exist).",
            fg=typer.colors.GREEN,
        )
    else:
        typer.secho(
            f"Template {template_id} deleted successfully.",
            fg=typer.colors.GREEN,
        )


@template_typer.command(help=CREATE_HELP, name="create", cls=CompatCommand)
def create(
    name: Optional[str] = typer.Argument(None, metavar="NAME", help="Template name"),
    description: str = typer.Option(..., "--description", "-d", help="Template description"),
    docker_image: str = typer.Option(..., "--docker-image", "-i", help="Docker image (e.g., ubuntu:latest)"),
    cpu_cores: int = typer.Option(1, "--cpu-cores", "-c", help="Number of CPU cores"),
    cpu_memory_gb: Optional[int] = typer.Option(None, "--cpu-memory", help="CPU memory in GB (default: 1)"),
    gpu_memory_gb: int = typer.Option(-1, "--gpu-memory", "-g", help="GPU memory in GB (-1 for no GPU)"),
    max_runtime_minutes: int = typer.Option(60, "--max-runtime", "-r", help="Max runtime in minutes"),
    access_rights: int = typer.Option(0, "--access-rights", "-a", help="Access rights (0=READ, 10=CREATE, etc.)"),
    command: Optional[str] = typer.Option(None, "--command", help="Optional command to run"),
    entrypoint: Optional[str] = typer.Option(None, "--entrypoint", help="Optional docker entrypoint"),
    name_flag: Optional[str] = typer.Option(None, "--name", "-n", hidden=True),
    cpu_memory_flag: Optional[int] = typer.Option(None, "-m", hidden=True),
) -> None:
    name = require(prefer_new(name, name_flag, old="--name/-n", new="the positional NAME argument"), "NAME")
    cpu_memory_gb = prefer_new(cpu_memory_gb, cpu_memory_flag, old=DEPRECATED_CPU_MEMORY_FLAG, new="--cpu-memory")

    client = AuthenticatedClient()
    template_id = kleinkram.core.create_template(
        client=client,
        name=name,
        description=description,
        docker_image=docker_image,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb if cpu_memory_gb is not None else 1,
        gpu_memory_gb=gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes,
        access_rights=access_rights,
        command=command,
        entrypoint=entrypoint,
    )

    typer.secho("Template successfully created", fg=typer.colors.GREEN)

    template_parsed = kleinkram.api.routes.get_template(client=client, template_id=template_id)
    print_templates_table([template_parsed], pprint=get_shared_state().verbose)
