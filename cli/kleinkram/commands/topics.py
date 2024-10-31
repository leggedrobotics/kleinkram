from __future__ import annotations

import typer

topic = typer.Typer(
    name="topic",
    help="Topic operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@topic.command("list")
def topics(
    file: str = typer.Option(help="Name of File"),
    full: bool = typer.Option(False, help="As a table with additional parameters"),
):
    raise NotImplementedError
