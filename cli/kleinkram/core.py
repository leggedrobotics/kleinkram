from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from typing import overload
from typing import Union
from uuid import UUID
"""\
this file contains the core functionality of `kleinkram`
"""


def upload() -> None: ...


def download() -> None: ...


def download_file(ids: List[UUID], dest: Path) -> None: ...
