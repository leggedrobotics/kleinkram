from __future__ import annotations

from typing import Any
from typing import Dict

# `klein upload`, `klein download` and `klein verify` are Typer groups (a
# callback with `invoke_without_command`) so that they show up as top-level
# commands with their own help panel. Click groups stop parsing options at
# the first positional argument, which made `klein upload a.bag --create`
# treat `--create` as a file name. With this, they accept options anywhere
# like a plain command; `--` still ends the options (for file names that
# start with `-`).
OPTIONS_ANYWHERE: Dict[str, Any] = {"allow_interspersed_args": True}
