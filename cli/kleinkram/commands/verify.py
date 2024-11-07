from __future__ import annotations

import typer


HELP = """\
Verify if files were uploaded correctly.
"""

verify_typer = typer.Typer(name="verify", invoke_without_command=True, help=HELP)


@verify_typer.callback()
def verify() -> None:
    raise NotImplementedError("Not implemented yet")
