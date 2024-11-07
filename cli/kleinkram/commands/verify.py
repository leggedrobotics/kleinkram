from __future__ import annotations


import typer


verify_typer = typer.Typer(name="verify", invoke_without_command=True)


@verify_typer.callback()
def verify() -> None:
    raise NotImplementedError("Not implemented yet")
