from __future__ import annotations

from pathlib import Path
from typing import List
from uuid import UUID

"""\
this file contains the core functionality of `kleinkram`
"""


def upload() -> None: ...


def download() -> None: ...


def download_file(ids: List[UUID], dest: Path) -> None: ...
