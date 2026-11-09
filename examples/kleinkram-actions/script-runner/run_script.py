#!/usr/bin/env python3
"""
Entrypoint of the shared script runner image.

Single-file actions have no image of their own: the user's script lives in
Kleinkram's script bucket, and the runner is handed a presigned URL for it in
``KLEINKRAM_SCRIPT_URL``. This module downloads that script, writes it to a
temporary file, and hands the process over to it, so the action's exit code is
the script's exit code and nothing sits between the script and its own output.
"""

from __future__ import annotations

import os
import sys
import tempfile
import urllib.error
import urllib.request
from typing import NoReturn

SCRIPT_URL_VARIABLE = "KLEINKRAM_SCRIPT_URL"
DOWNLOAD_TIMEOUT_SECONDS = 60


def _fail(message: str) -> NoReturn:
    print(f"script-runner: {message}", file=sys.stderr, flush=True)
    raise SystemExit(1)


def main() -> None:
    url = os.environ.get(SCRIPT_URL_VARIABLE)
    if not url:
        _fail(
            f"{SCRIPT_URL_VARIABLE} is not set. This image only runs scripts submitted with "
            "`klein action run-script`; it is not meant to be launched on its own."
        )

    try:
        with urllib.request.urlopen(url, timeout=DOWNLOAD_TIMEOUT_SECONDS) as response:
            source = response.read()
    except urllib.error.URLError as error:
        _fail(f"could not download the script: {error}")

    # Written into a directory of its own so the script gets a predictable
    # filename in tracebacks and nothing else can shadow it on the path.
    script_directory = tempfile.mkdtemp(prefix="kleinkram-script-")
    script_path = os.path.join(script_directory, "action.py")
    with open(script_path, "wb") as handle:
        handle.write(source)

    # `execv` replaces this process, so the script's exit code, signals and
    # output are the container's, with no wrapper left to translate them.
    os.execv(sys.executable, [sys.executable, script_path, *sys.argv[1:]])


if __name__ == "__main__":
    main()
