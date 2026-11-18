"""\
`verify` only looks files up, so it must find files that were uploaded under
an older naming rule (e.g. `-dash.bag`) as well as files that an upload
renamed (`--fix-filenames`), server mocked
"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

import kleinkram.core
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.models import FileState
from kleinkram.models import FileVerificationStatus
from kleinkram.utils import b64_md5

QUERY = MissionQuery(patterns=["m"], project_query=ProjectQuery(patterns=["p"]))


@pytest.fixture
def mission_with(monkeypatch):
    """returns a function that makes the mocked mission hold the given local files under the given names"""

    def setup(stored: dict[str, Path]) -> None:
        routes = MagicMock()
        routes.get_files.return_value = [
            SimpleNamespace(name=name, state=FileState.OK, hash=b64_md5(path), size=path.stat().st_size)
            for name, path in stored.items()
        ]
        monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)

    return setup


@pytest.mark.parametrize("name", ["-dash.bag", "0b4e4a5e-6c1e-4c5e-9f3e-1d2c3b4a5f6e.bag", "run(1).bag"])
def test_verify_finds_files_stored_under_an_older_naming_rule(mission_with, tmp_path, name):
    path = tmp_path / name
    path.write_bytes(b"data")
    mission_with({name: path})

    status = kleinkram.core.verify(client=MagicMock(), query=QUERY, file_paths=[path])

    assert status == {path: FileVerificationStatus.UPLOADED}


def test_verify_finds_files_renamed_by_fix_filenames(mission_with, tmp_path):
    path = tmp_path / "bad name.bag"
    path.write_bytes(b"data")
    mission_with({"bad_name.bag": path})

    status = kleinkram.core.verify(client=MagicMock(), query=QUERY, file_paths=[path])

    assert status == {path: FileVerificationStatus.UPLOADED}


def test_verify_reports_missing_file_with_an_old_style_name(mission_with, tmp_path):
    path = tmp_path / "-dash.bag"
    path.write_bytes(b"data")
    mission_with({})

    status = kleinkram.core.verify(client=MagicMock(), query=QUERY, file_paths=[path])

    assert status == {path: FileVerificationStatus.MISSING}
