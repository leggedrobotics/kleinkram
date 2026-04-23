from __future__ import annotations

from typing import Optional

import typer

import kleinkram.api.routes
import kleinkram.wrappers
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
CREATE_HELP = "Creates a new action template."


@templates_typer.command(help=LIST_HELP, name="list")
def list_templates() -> None:
    client = AuthenticatedClient()
    templates = list(kleinkram.api.routes.get_templates(client))

    if not templates:
        typer.echo("No action templates found.")
        return

    print_templates_table(templates, pprint=get_shared_state().verbose)


@templates_typer.command(help="Deletes an action template.", name="delete")
def delete(template: str = typer.Argument(..., help="Template ID (UUID)")) -> None:
    client = AuthenticatedClient()
    kleinkram.wrappers.delete_template(template_id=template, client=client)
    typer.secho(f"Template {template} successfully deleted", fg=typer.colors.GREEN)


@templates_typer.command(help=CREATE_HELP, name="create")
def create(
    name: str = typer.Option(..., "--name", "-n", help="Template name"),
    description: str = typer.Option(..., "--description", "-d", help="Template description"),
    docker_image: str = typer.Option(..., "--docker-image", "-i", help="Docker image (e.g., ubuntu:latest)"),
    cpu_cores: int = typer.Option(1, "--cpu-cores", "-c", help="Number of CPU cores"),
    cpu_memory_gb: int = typer.Option(1, "--cpu-memory", "-m", help="CPU memory in GB"),
    gpu_memory_gb: int = typer.Option(0, "--gpu-memory", "-g", help="GPU memory in GB"),
    max_runtime_minutes: int = typer.Option(60, "--max-runtime", "-r", help="Max runtime in minutes"),
    access_rights: int = typer.Option(0, "--access-rights", "-a", help="Access rights (0=READ, 10=CREATE, etc.)"),
    command: Optional[str] = typer.Option(None, "--command", help="Optional command to run"),
    entrypoint: Optional[str] = typer.Option(None, "--entrypoint", help="Optional docker entrypoint"),
) -> None:
    client = AuthenticatedClient()
    template_id = kleinkram.wrappers.create_template(
        name=name,
        description=description,
        docker_image=docker_image,
        cpu_cores=cpu_cores,
        cpu_memory_gb=cpu_memory_gb,
        gpu_memory_gb=gpu_memory_gb,
        max_runtime_minutes=max_runtime_minutes,
        access_rights=access_rights,
        command=command,
        entrypoint=entrypoint,
        client=client,
    )

    typer.secho("Template successfully created", fg=typer.colors.GREEN)

    template_parsed = kleinkram.wrappers.get_template(template_id, client=client)
    print_templates_table([template_parsed], pprint=get_shared_state().verbose)
