from __future__ import annotations


"""\
this file contains the core functionality of `kleinkram`
"""

from typing import overload, Union, List, Optional
from uuid import UUID
from pathlib import Path


def upload() -> None: ...


def download() -> None: ...


def download_file(ids: List[UUID], dest: Path) -> None: ...
