from __future__ import annotations

import typer

mission_typer = typer.Typer(
    no_args_is_help=True, context_settings={"help_option_names": ["-h", "--help"]}
)

NOT_IMPLEMENTED_YET = "Not implemented yet"


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def update() -> None:
    raise NotImplementedError("Not implemented yet")


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def create() -> None:
    raise NotImplementedError("Not implemented yet")


@mission_typer.command(help=NOT_IMPLEMENTED_YET)
def delete() -> None:
    raise NotImplementedError("Not implemented yet")
