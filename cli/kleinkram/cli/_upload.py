from __future__ import annotations

from pathlib import Path
from typing import List
from typing import Optional
from uuid import UUID

import typer

import kleinkram.core
import kleinkram.utils
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli._file_validator import FileValidator
from kleinkram.cli._file_validator import _report_skipped_files
from kleinkram.cli._progress import transfer_progress
from kleinkram.config import get_shared_state
from kleinkram.errors import MissionNotFound
from kleinkram.utils import format_bytes
from kleinkram.utils import load_metadata
from kleinkram.utils import split_args

HELP = """\
Upload files to kleinkram.
"""
