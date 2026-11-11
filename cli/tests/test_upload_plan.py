"""\
`klein upload --dry-run` / `kleinkram.core.plan_upload`: report what an
upload would do, with the same errors as a real upload, without writing
anything to the server; the server is mocked here, see `test_core.py` and
`test_end_to_end.py` for the same against a real backend
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from typer.testing import CliRunner

import kleinkram.cli.app
import kleinkram.core
import kleinkram.errors
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.cli.app import app
from kleinkram.errors import MissionNotFound
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.models import Mission
from kleinkram.models import Project
from kleinkram.models import UploadAction
from kleinkram.utils import b64_md5

NOW = datetime(2026, 1, 1)
PROJECT = Project(
    id=uuid4(),
    name="proj",
    description="",
    created_at=NOW,
    updated_at=NOW,
    required_metadata_types=["robot"],
)
MISSION = Mission(
    id=uuid4(),
    name="run42",
    created_at=NOW,
    updated_at=NOW,
    project_id=PROJECT.id,
    project_name=PROJECT.name,
)
QUERY = MissionQuery(patterns=["run42"], project_query=ProjectQuery(patterns=["proj"]))


def remote_file(path: Path, *, name: str = "", state: FileState = FileState.OK, hash_: str = "") -> File:
    return File(
        id=uuid4(),
        name=name or path.name,
        hash=hash_ or b64_md5(path),
        size=path.stat().st_size,
        type_="MCAP",
        date=NOW,
        created_at=NOW,
        updated_at=NOW,
        mission_id=MISSION.id,
        mission_name=MISSION.name,
        project_id=PROJECT.id,
        project_name=PROJECT.name,
        state=state,
    )


@pytest.fixture
def files(tmp_path: Path) -> List[Path]:
    """new.mcap, same.mcap, changed.mcap, longer.mcap, busy.mcap, retry.mcap"""
    paths = []
    for name in ["new", "same", "changed", "longer", "busy", "retry"]:
        path = tmp_path / f"{name}.mcap"
        path.write_bytes(f"local {name}".encode())
        paths.append(path)
    return paths


@pytest.fixture
def server(monkeypatch, tmp_path, files) -> MagicMock:
    """\
    a mission that already holds files with the names of all local files but
    `new.mcap`, every route that writes fails the test
    """
    remote_dir = tmp_path / "remote"
    remote_dir.mkdir()

    def remote_copy(name: str, content: str) -> Path:
        path = remote_dir / name
        path.write_bytes(content.encode())
        return path

    by_name = {p.name: p for p in files}
    remote = [
        remote_file(by_name["same.mcap"]),
        # same size, other content
        remote_file(remote_copy("changed.mcap", "local CHANGED")),
        remote_file(remote_copy("longer.mcap", "a different, longer content")),
        remote_file(by_name["busy.mcap"], state=FileState.UPLOADING),
        remote_file(by_name["retry.mcap"], state=FileState.CANCELED),
    ]

    routes = MagicMock()
    routes.get_mission.return_value = MISSION
    routes.get_project.return_value = PROJECT
    routes.get_files.return_value = remote
    for name in dir(kleinkram.api.routes):
        if name.startswith("_create") or name.startswith("_update") or name.startswith("_delete"):
            getattr(routes, name).side_effect = AssertionError(f"dry run called {name}")
    monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)
    monkeypatch.setattr(kleinkram.core, "_mission_name_is_available", lambda *_: True)
    monkeypatch.setattr(kleinkram.core, "_get_metadata_type_id_by_name", lambda _client, key: (uuid4(), None))
    monkeypatch.setattr(kleinkram.core, "_validate_metadata_value", lambda *_: None)
    upload_files = MagicMock(side_effect=AssertionError("dry run uploaded"))
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", upload_files)
    return routes


# --------------------------------------------------------------------------
# plan_upload
# --------------------------------------------------------------------------


def test_plan_for_existing_mission(server, files):
    plan = kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=files)

    assert plan.mission_id == MISSION.id
    assert not plan.creates_mission
    assert (plan.project_name, plan.mission_name) == ("proj", "run42")
    assert {e.name: e.action for e in plan.files} == {
        "new.mcap": UploadAction.UPLOAD,
        "same.mcap": UploadAction.SKIP_SAME,
        "changed.mcap": UploadAction.SKIP_DIFFERENT,
        "longer.mcap": UploadAction.SKIP_DIFFERENT,
        "busy.mcap": UploadAction.SKIP_UNCHECKED,
        # the server reuses canceled uploads
        "retry.mcap": UploadAction.UPLOAD,
    }
    assert {e.name: e.remote_state for e in plan.files}["busy.mcap"] == FileState.UPLOADING
    assert [e.path for e in plan.files] == files
    assert all(e.size == e.path.stat().st_size for e in plan.files)


def test_plan_only_hashes_files_with_a_taken_name(server, files, monkeypatch):
    hashed = []
    real_b64_md5 = kleinkram.core.b64_md5
    monkeypatch.setattr(kleinkram.core, "b64_md5", lambda p: hashed.append(p.name) or real_b64_md5(p))

    kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=files)

    # not new/retry (free name), not longer (size differs), not busy (no remote hash to compare)
    assert sorted(hashed) == ["changed.mcap", "same.mcap"]


def test_plan_uses_sanitized_names(server, tmp_path):
    bad = tmp_path / "a b.mcap"
    bad.write_bytes(b"x")
    plan = kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=[bad], fix_filenames=True)
    assert [(e.path, e.name) for e in plan.files] == [(bad, "a_b.mcap")]


def test_plan_rejects_bad_names_like_upload(server, tmp_path):
    bad = tmp_path / "a b.mcap"
    bad.write_bytes(b"x")
    with pytest.raises(kleinkram.errors.FileNameNotSupported):
        kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=[bad])


def test_plan_rejects_name_clash_before_contacting_the_server(server, tmp_path):
    for run in ("run1", "run2"):
        (tmp_path / run).mkdir()
        (tmp_path / run / "data.mcap").write_bytes(run.encode())
    with pytest.raises(ValueError, match="same name"):
        kleinkram.core.plan_upload(
            client=MagicMock(),
            query=QUERY,
            file_paths=[tmp_path / "run1/data.mcap", tmp_path / "run2/data.mcap"],
        )
    server.get_mission.assert_not_called()


def test_plan_missing_mission_without_create_raises(server, files):
    server.get_mission.side_effect = MissionNotFound("nope")
    with pytest.raises(MissionNotFound):
        kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=files)


def test_plan_missing_mission_with_create(server, files):
    server.get_mission.side_effect = MissionNotFound("nope")
    plan = kleinkram.core.plan_upload(
        client=MagicMock(), query=QUERY, file_paths=files, create=True, metadata={"robot": "anymal"}
    )
    assert plan.creates_mission
    assert (plan.project_name, plan.mission_name) == ("proj", "run42")
    assert all(e.action == UploadAction.UPLOAD for e in plan.files)
    server.get_files.assert_not_called()


def test_plan_create_checks_required_metadata(server, files):
    server.get_mission.side_effect = MissionNotFound("nope")
    with pytest.raises(kleinkram.errors.InvalidMissionMetadata):
        kleinkram.core.plan_upload(client=MagicMock(), query=QUERY, file_paths=files, create=True, metadata={})


def test_plan_create_checks_mission_name(server, files, monkeypatch):
    server.get_mission.side_effect = MissionNotFound("nope")
    monkeypatch.setattr(kleinkram.core, "_mission_name_is_available", lambda *_: False)
    with pytest.raises(kleinkram.errors.MissionExists):
        kleinkram.core.plan_upload(
            client=MagicMock(), query=QUERY, file_paths=files, create=True, metadata={"robot": "anymal"}
        )


# --------------------------------------------------------------------------
# klein upload --dry-run
# --------------------------------------------------------------------------


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture
def cli(monkeypatch, tmp_path, server):
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)
    upload = MagicMock(side_effect=AssertionError("dry run called core.upload"))
    monkeypatch.setattr("kleinkram.core.upload", upload)
    return upload


def test_cli_dry_run_lines_for_scripts(runner, cli, files):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", "--dry-run", *map(str, files)])
    assert result.exit_code == 0, result.output

    lines = [line.split("\t") for line in result.stdout.splitlines()]
    assert lines == [
        ["upload", str(files[0]), "new.mcap"],
        ["skip-same", str(files[1]), "same.mcap"],
        ["skip-different", str(files[2]), "changed.mcap"],
        ["skip-different", str(files[3]), "longer.mcap"],
        ["skip-unchecked", str(files[4]), "busy.mcap"],
        ["upload", str(files[5]), "retry.mcap"],
    ]
    assert "Dry run" in result.stderr
    assert "Mission proj/run42 exists." in result.stderr
    assert "Would upload 2 file(s)" in result.stderr
    assert "skip 4" in result.stderr
    assert "2 file(s) would be skipped although a different file" in result.stderr
    cli.assert_not_called()


def test_cli_dry_run_table(runner, cli, files):
    result = runner.invoke(
        app,
        ["--verbose", "upload", "-p", "proj", "-m", "run42", "--dry-run", *map(str, files)],
        env={"COLUMNS": "250"},  # keep rich from wrapping the cells
    )
    assert result.exit_code == 0, result.output
    for text in ["new.mcap", "name taken by a different file", "remote state UPLOADING", "Would upload 2 file(s)"]:
        assert text in result.stdout
    cli.assert_not_called()


def test_cli_dry_run_would_create_mission(runner, cli, server, files, tmp_path):
    server.get_mission.side_effect = MissionNotFound("nope")
    meta = tmp_path / "meta.yaml"
    meta.write_text("robot: anymal\n")
    result = runner.invoke(
        app,
        ["--no-verbose", "upload", "-p", "proj", "-m", "run42", "--create", "--metadata", str(meta), "--dry-run"]
        + [str(f) for f in files],
    )
    assert result.exit_code == 0, result.output
    assert "Mission proj/run42 would be created." in result.stderr
    assert all(line.startswith("upload\t") for line in result.stdout.splitlines())


def test_cli_dry_run_missing_mission_fails_like_upload(runner, cli, server, files):
    server.get_mission.side_effect = MissionNotFound("nope")
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", "--dry-run", str(files[0])])
    assert result.exit_code != 0
    assert isinstance(result.exception, MissionNotFound)


@pytest.mark.parametrize("debug", ["--debug", "--no-debug"])
def test_cli_dry_run_stdout_stays_parsable_with_skipped_inputs(runner, cli, files, tmp_path, debug):
    """the --skip report goes to stderr, stdout only holds the plan lines"""
    unsupported = tmp_path / "notes.txt"
    unsupported.write_text("x")
    args = [debug, "--no-verbose", "upload", "-p", "proj", "-m", "run42", "--dry-run", "--skip"]
    result = runner.invoke(app, [*args, str(unsupported), *map(str, files)])

    assert result.exit_code == 0, result.output
    lines = result.stdout.splitlines()
    assert len(lines) == len(files)
    assert all(len(line.split("\t")) == 3 for line in lines)
    assert "Skipped 1 path(s)" in result.stderr or "Skipped: " in result.stderr


def test_cli_dry_run_escapes_tabs_and_newlines_in_paths(runner, cli, tmp_path):
    odd_dir = tmp_path / "with\ttab and\nnewline\\"
    odd_dir.mkdir()
    file = odd_dir / "new.mcap"
    file.write_bytes(b"x")

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", "--dry-run", str(file)])

    assert result.exit_code == 0, result.output
    (line,) = result.stdout.splitlines()
    action, path, name = line.split("\t")
    assert (action, name) == ("upload", "new.mcap")
    assert path == str(file).replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")


def test_cli_dry_run_table_respects_max_lines(runner, cli, files):
    result = runner.invoke(
        app,
        ["--verbose", "--max-lines", "2", "upload", "-p", "proj", "-m", "run42", "--dry-run", *map(str, files)],
        env={"COLUMNS": "250"},
    )
    assert result.exit_code == 0, result.output
    assert "new.mcap" in result.stdout and "same.mcap" in result.stdout
    assert "retry.mcap" not in result.stdout
    assert "Would upload 2 file(s)" in result.stdout  # the summary still counts every file


def test_cli_dry_run_script_output_ignores_max_lines(runner, cli, files):
    result = runner.invoke(
        app, ["--no-verbose", "--max-lines", "2", "upload", "-p", "proj", "-m", "run42", "--dry-run", *map(str, files)]
    )
    assert result.exit_code == 0, result.output
    assert len(result.stdout.splitlines()) == len(files)


def test_cli_dry_run_table_unlimited_max_lines_shows_every_file(runner, cli, files):
    result = runner.invoke(
        app,
        ["--verbose", "--max-lines", "-1", "upload", "-p", "proj", "-m", "run42", "--dry-run", *map(str, files)],
        env={"COLUMNS": "250"},
    )
    assert result.exit_code == 0, result.output
    for file in files:
        assert file.name in result.stdout
    assert "..." not in result.stdout
