"""\
turns the FILES arguments of `klein upload` / `klein verify` into file paths

Shells disagree on wildcards: zsh and fish expand `**` recursively; bash
(without `shopt -s globstar`), sh and PowerShell on Linux / macOS treat `**`
like `*` and silently miss deeper files; PowerShell and cmd on Windows do not
expand wildcards for programs at all. To make the result independent of the
shell, the CLI

- expands patterns itself (`glob(..., recursive=True)`), so a quoted
  `'**/*.mcap'` behaves the same everywhere, and
- walks directories when `--recursive` is given.
"""

from __future__ import annotations

import glob
import os
from pathlib import Path
from typing import Collection
from typing import List
from typing import Sequence
from typing import Set

import typer

GLOB_CHARS = frozenset("*?[")


def _has_glob_chars(arg: str) -> bool:
    return any(char in GLOB_CHARS for char in arg)


def _raise(error: OSError) -> None:
    raise error


def _walk_directory(directory: Path, suffixes: Collection[str]) -> List[Path]:
    """\
    all files below `directory` with one of `suffixes`, sorted, skipping
    hidden files; hidden directories (`.git`, `.venv`, ...) are not entered

    the suffix match is case-sensitive like the upload itself (`check_file_paths`
    and the server accept `.mcap`, not `.MCAP`), so a recursive walk never picks
    a file that would then stop the whole upload

    a directory that cannot be read raises instead of being left out, so a
    recursive upload or verify never silently covers only part of the tree
    """
    wanted = set(suffixes)
    found = []
    for root, dirs, files in os.walk(directory, onerror=_raise):
        dirs[:] = [name for name in dirs if not name.startswith(".")]
        for name in files:
            path = Path(root) / name
            if not name.startswith(".") and path.suffix in wanted and path.is_file():
                found.append(path)
    return sorted(found)


def expand_file_args(args: Sequence[str], *, recursive: bool, suffixes: Collection[str]) -> List[Path]:
    """\
    - an argument that exists is taken as is; a directory is replaced by the
      files below it with a supported suffix if `recursive` is set, otherwise
      it is passed on (and rejected or skipped by the `FileValidator`)
    - an argument that does not exist but contains `*`, `?` or `[` is expanded
      as a recursive glob pattern (`**` matches any number of directories);
      each match is treated like an argument of its own
    - anything else is passed on unchanged, the `FileValidator` reports it

    the result is free of duplicates (by resolved path), in argument order
    """
    candidates: List[Path] = []
    for arg in args:
        path = Path(arg)
        matches = sorted(glob.glob(arg, recursive=True)) if not path.exists() and _has_glob_chars(arg) else []
        if matches:
            candidates.extend(Path(match) for match in matches)
        else:
            candidates.append(path)

    result: List[Path] = []
    seen: Set[Path] = set()
    for candidate in candidates:
        if recursive and candidate.is_dir():
            files = _walk_directory(candidate, suffixes)
            if not files:
                typer.echo(
                    typer.style(f"No supported files found in directory {candidate}", fg=typer.colors.YELLOW),
                    err=True,
                )
        else:
            files = [candidate]

        for file in files:
            key = file.resolve()
            if key not in seen:
                seen.add(key)
                result.append(file)

    return result
