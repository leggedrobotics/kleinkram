"""\
helpers to keep deprecated CLI syntax working while steering users to the new one

Every deprecated form stays accepted (but hidden from `--help`) until
`REMOVED_IN`, and prints a warning to stderr when used so that piped
output is not affected. `tests/test_cli_deprecations.py` fails once the
CLI version reaches `REMOVED_IN` as a reminder to drop them.
"""

from __future__ import annotations

import sys
from typing import Any
from typing import List
from typing import Optional
from typing import TypeVar

import typer
from typer.core import TyperCommand

REMOVED_IN = "1.0.0"

T = TypeVar("T")


class CompatCommand(TyperCommand):
    """\
    command whose positional arguments are only optional to keep a deprecated
    syntax working; the usage line shows them as required and leaves out
    hidden (deprecated) arguments
    """

    def collect_usage_pieces(self, ctx: Any) -> List[str]:
        pieces = [self.options_metavar] if self.options_metavar else []
        for param in self.get_params(ctx):
            if getattr(param, "param_type_name", None) != "argument":
                continue
            if getattr(param, "hidden", False):
                continue
            pieces.extend(piece.strip("[]{}") for piece in param.get_usage_pieces(ctx))
        return pieces


def warn_deprecated(old: str, new: str) -> None:
    typer.secho(
        f"Warning: {old} is deprecated and will be removed in kleinkram {REMOVED_IN}, use {new} instead.",
        fg=typer.colors.YELLOW,
        err=True,
    )


def prefer_new(new_value: Optional[T], old_value: Optional[T], *, old: str, new: str) -> Optional[T]:
    """\
    merge a value given via the new syntax with one given via a deprecated syntax
    """
    if old_value is None:
        return new_value
    if new_value is not None and new_value != old_value:
        raise typer.BadParameter(f"pass either {new} or {old}, not both")
    warn_deprecated(old, new)
    return old_value


def prefer_new_list(new_values: Optional[List[str]], old_value: Optional[str], *, old: str, new: str) -> List[str]:
    """\
    like `prefer_new` but for a repeatable positional argument
    """
    if old_value is None:
        return list(new_values or [])
    if new_values:
        raise typer.BadParameter(f"pass either {new} or {old}, not both")
    warn_deprecated(old, new)
    return [old_value]


def require(value: Optional[T], name: str) -> T:
    if value is None:
        raise typer.BadParameter(f"missing argument {name}")
    return value


def confirm_deletion(prompt: str, *, yes: bool, legacy_no_prompt: bool = False) -> None:
    """\
    ask before deleting, `--yes` skips the prompt

    `legacy_no_prompt` marks commands that used to delete without asking;
    in non-interactive sessions they keep doing so (with a warning) until
    `REMOVED_IN` so that existing scripts do not break
    """
    if yes:
        return
    if sys.stdin.isatty():
        typer.confirm(f"{prompt}?", abort=True)
        return
    if legacy_no_prompt:
        warn_deprecated("deleting without --yes in a non-interactive session", "--yes")
        return
    raise typer.BadParameter("refusing to delete without confirmation in a non-interactive session, pass --yes")
