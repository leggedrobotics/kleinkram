from __future__ import annotations

from logging import getLogger
from pathlib import Path
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from uuid import UUID

from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.file_transfer import download_files as _download_files
from kleinkram.config import get_shared_state
from kleinkram.models import File
from kleinkram.models import files_to_table
from kleinkram.resources import FileSpec
from kleinkram.resources import get_files_by_spec
from kleinkram.resources import MissionSpec
from kleinkram.resources import ProjectSpec
from rich.console import Console

logger = getLogger(__name__)


__all__ = [
    "download",
]


def _file_desitations(
    files: Sequence[File], *, dest: Path, allow_nested: bool = False
) -> Dict[Path, File]:
    if (
        len(set([(file.project_id, file.mission_id) for file in files])) > 1
        and not allow_nested
    ):
        raise ValueError("files from multiple missions were selected")
    elif not allow_nested:
        return {dest / file.name: file for file in files}
    else:
        return {
            dest / file.project_name / file.mission_name / file.name: file
            for file in files
        }


def _file_spec_from_args(
    file_ids: Optional[List[UUID]] = None,
    file_patterns: Optional[List[str]] = None,
    mission_ids: Optional[List[UUID]] = None,
    mission_patterns: Optional[List[str]] = None,
    project_ids: Optional[List[UUID]] = None,
    project_patterns: Optional[List[str]] = None,
) -> FileSpec:
    project_spec = ProjectSpec(ids=project_ids or [], patterns=project_patterns or [])
    mission_spec = MissionSpec(
        ids=mission_ids or [],
        patterns=mission_patterns or [],
        project_spec=project_spec,
    )
    file_spec = FileSpec(
        ids=file_ids or [],
        patterns=file_patterns or [],
        mission_spec=mission_spec,
    )
    return file_spec


def download(
    dest: Path,
    *,
    spec: Optional[FileSpec] = None,
    ids: Optional[List[UUID]] = None,
    patterns: Optional[List[str]] = None,
    mission_ids: Optional[List[UUID]] = None,
    mission_patterns: Optional[List[str]] = None,
    project_ids: Optional[List[UUID]] = None,
    allow_nested: bool = False,
    overwrite: bool = False,
    verbose: bool = False,
) -> None:
    client = AuthenticatedClient()

    if spec is not None and any([ids, patterns, mission_ids, mission_patterns]):
        raise ValueError(
            "cannot specify both a file spec and file ids, patterns, mission ids or mission patterns"
        )

    if spec is None:
        spec = _file_spec_from_args(
            file_ids=ids,
            file_patterns=patterns,
            mission_ids=mission_ids,
            mission_patterns=mission_patterns,
            project_ids=project_ids,
        )
    files = get_files_by_spec(client, spec)

    if verbose:
        Console().print(files_to_table(files, title="downloading files..."))

    paths = _file_desitations(files, dest=dest, allow_nested=allow_nested)
    logger.info(f"downloading {len(paths)} file(s) to {dest}")
    _download_files(
        client, paths, verbose=get_shared_state().verbose, overwrite=overwrite
    )
