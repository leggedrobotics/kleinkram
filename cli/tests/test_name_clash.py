"""\
`upload` and `verify` must refuse files that would get the same name in the
mission before they talk to the server; otherwise `upload(create=True)`
would create the mission and only then fail (server mocked)
"""

from __future__ import annotations

from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import pytest

import kleinkram.core
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery

QUERY = MissionQuery(patterns=["m"], project_query=ProjectQuery(patterns=["p"]))


@pytest.fixture
def clashing(tmp_path: Path) -> List[Path]:
    paths = []
    for run in ("run1", "run2"):
        (tmp_path / run).mkdir()
        path = tmp_path / run / "data.mcap"
        path.write_bytes(run.encode())
        paths.append(path)
    return paths


@pytest.fixture
def routes(monkeypatch) -> MagicMock:
    routes = MagicMock()
    monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)
    upload_files = MagicMock()
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", upload_files)
    routes.upload_files = upload_files
    return routes


def test_upload_refuses_clash_before_contacting_the_server(routes, clashing):
    with pytest.raises(ValueError, match="same name"):
        kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=clashing, create=True)
    assert routes.mock_calls == []


def test_verify_refuses_clash_before_contacting_the_server(routes, clashing):
    with pytest.raises(ValueError, match="same name"):
        kleinkram.core.verify(client=MagicMock(), query=QUERY, file_paths=clashing)
    assert routes.mock_calls == []
