"""\
the server skips a file whose name is taken in the mission without looking
at its content; `klein upload` must not report a changed local file as
"already uploaded", see `kleinkram.core._check_existing_files`

server mocked here, see `test_core.py` / `test_end_to_end.py` for the same
against a real backend
"""

from __future__ import annotations

from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import httpx
import pytest
from typer.testing import CliRunner

import kleinkram.api.file_transfer
import kleinkram.cli.app
import kleinkram.core
import kleinkram.errors
from kleinkram.api.file_transfer import UploadResult
from kleinkram.api.file_transfer import UploadState
from kleinkram.cli.app import app
from kleinkram.errors import get_transfer_result
from kleinkram.models import FileState
from tests.test_upload_plan import MISSION
from tests.test_upload_plan import QUERY
from tests.test_upload_plan import remote_file


@pytest.fixture
def files(tmp_path: Path) -> List[Path]:
    """same.mcap, changed.mcap, busy.mcap, new.mcap"""
    paths = []
    for name in ["same", "changed", "busy", "new"]:
        path = tmp_path / f"{name}.mcap"
        path.write_bytes(f"local {name}".encode())
        paths.append(path)
    return paths


@pytest.fixture
def remote(tmp_path: Path, files: List[Path]):
    remote_dir = tmp_path / "remote"
    remote_dir.mkdir()
    changed = remote_dir / "changed.mcap"
    changed.write_bytes(b"other content")
    same, _, busy, _ = files
    return [
        remote_file(same),
        remote_file(changed),
        remote_file(busy, state=FileState.UPLOADING),
    ]


@pytest.fixture
def routes(monkeypatch, remote) -> MagicMock:
    routes = MagicMock()
    routes.get_mission.return_value = MISSION
    routes.get_files.return_value = remote
    monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)
    return routes


# --------------------------------------------------------------------------
# upload_files records which files the server refused
# --------------------------------------------------------------------------


def test_upload_files_records_existing(monkeypatch, files):
    taken = {"same.mcap", "changed.mcap"}

    def fake_upload_file(*, filename, path, **_):
        return (UploadState.EXISTS, 0) if filename in taken else (UploadState.UPLOADED, path.stat().st_size)

    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_file", fake_upload_file)
    result = kleinkram.api.file_transfer.upload_files(MagicMock(), {p.name: p for p in files}, MISSION.id)

    assert (result.uploaded, result.skipped) == (2, 2)
    assert sorted(p.name for p in result.existing) == sorted(taken)
    assert result.conflicts == [] and result.unchecked == []


# --------------------------------------------------------------------------
# kleinkram.core.upload compares them with the mission
# --------------------------------------------------------------------------


def fake_upload_files(existing: List[Path]) -> MagicMock:
    return MagicMock(return_value=UploadResult(uploaded=1, skipped=len(existing), existing=list(existing)))


def test_upload_flags_changed_files(monkeypatch, routes, files):
    same, changed, busy, new = files
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([same, changed, busy]))
    messages = []

    result = kleinkram.core.upload(
        client=MagicMock(), query=QUERY, file_paths=files, on_message_cb=lambda m, e: messages.append((m, e))
    )

    assert result.conflicts == [changed]
    assert result.unchecked == [busy]
    assert messages == [(f"NOT uploaded {changed}: a different file named changed.mcap is in the mission", True)]
    routes.get_files.assert_called_once()


def test_upload_without_existing_files_does_not_compare(monkeypatch, routes, files):
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([]))
    result = kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=files)
    assert result.conflicts == [] and result.unchecked == []
    routes.get_files.assert_not_called()


def test_upload_compare_failure_does_not_fail_the_upload(monkeypatch, routes, files):
    routes.get_files.side_effect = httpx.ConnectError("down")
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[1]]))
    messages = []

    result = kleinkram.core.upload(
        client=MagicMock(), query=QUERY, file_paths=files, on_message_cb=lambda m, e: messages.append((m, e))
    )

    assert result.uploaded == 1 and result.conflicts == []
    assert result.unchecked == [files[1]]
    assert messages == [("could not compare skipped files with the mission: down", True)]


def test_upload_ctrl_c_during_compare_keeps_the_result(monkeypatch, routes, files):
    routes.get_files.side_effect = KeyboardInterrupt
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[1]]))

    with pytest.raises(KeyboardInterrupt) as exc_info:
        kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=files)

    assert type(exc_info.value) is KeyboardInterrupt  # exit code 130 needs the exact type
    partial = get_transfer_result(exc_info.value)
    assert partial is not None and partial.uploaded == 1


def test_cli_quiet_mode_reports_a_failed_compare(runner, offline_cli, monkeypatch, routes, files):
    """no message callback with --no-verbose: the warning must still be printed"""
    routes.get_files.side_effect = httpx.ConnectError("down")
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[1]]))

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", *map(str, files)])

    assert result.exit_code == 0, result.output
    assert "could not be compared" in result.stderr
    assert f"  {files[1]}\n" in result.stderr


def test_cli_ctrl_c_during_compare_exits_130(runner, offline_cli, monkeypatch, routes, files):
    routes.get_files.side_effect = KeyboardInterrupt
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[1]]))

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", *map(str, files)])

    assert result.exit_code == 130, result.output


# --------------------------------------------------------------------------
# klein upload
# --------------------------------------------------------------------------


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture
def offline_cli(monkeypatch, tmp_path):
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)


@pytest.fixture
def cli(monkeypatch, offline_cli):
    def set_result(result: UploadResult) -> None:
        monkeypatch.setattr("kleinkram.core.upload", MagicMock(return_value=result))

    return set_result


@pytest.mark.parametrize("verbose", ["--verbose", "--no-verbose"])
def test_cli_changed_file_fails(runner, cli, files, verbose):
    same, changed, busy, _ = files
    cli(UploadResult(uploaded=1, skipped=3, existing=[same, changed, busy], conflicts=[changed], unchecked=[busy]))

    result = runner.invoke(app, [verbose, "upload", "-p", "proj", "-m", "run42", *map(str, files)])

    assert result.exit_code == 1, result.output
    assert "1 file(s) were NOT uploaded" in result.stderr
    assert f"  {changed}\n" in result.stderr
    assert "klein file delete" in result.stderr
    assert "could not be compared" in result.stderr
    assert f"  {busy}\n" in result.stderr


def test_cli_unchecked_only_warns(runner, cli, files):
    busy = files[2]
    cli(UploadResult(uploaded=3, skipped=1, existing=[busy], unchecked=[busy]))

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", *map(str, files)])

    assert result.exit_code == 0, result.output
    assert "could not be compared" in result.stderr
    assert "NOT uploaded" not in result.stderr


def test_cli_identical_existing_files_are_fine(runner, cli, files):
    cli(UploadResult(uploaded=3, skipped=1, existing=[files[0]]))

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "proj", "-m", "run42", *map(str, files)])

    assert result.exit_code == 0, result.output
    assert "NOT uploaded" not in result.stderr
    assert "could not be compared" not in result.stderr


def test_upload_keeps_result_when_the_compare_fails_otherwise(monkeypatch, routes, files):
    """not only network errors: e.g. a failed token refresh raises NotAuthenticated"""
    routes.get_files.side_effect = kleinkram.errors.NotAuthenticated()
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[1]]))

    result = kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=files)

    assert result.uploaded == 1
    assert result.unchecked == [files[1]]


def test_upload_unreadable_local_file_during_compare_is_unchecked(monkeypatch, routes, files):
    same, changed = files[0], files[1]
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([same, changed]))
    real_b64_md5 = kleinkram.core.b64_md5

    def flaky_md5(path):
        if path == same:
            raise PermissionError("denied")
        return real_b64_md5(path)

    monkeypatch.setattr(kleinkram.core, "b64_md5", flaky_md5)

    result = kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=files)

    assert result.unchecked == [same]
    assert result.conflicts == [changed]


def test_upload_blocking_file_gone_before_compare_is_unchecked(monkeypatch, routes, remote, files):
    """the server refused `same.mcap`, but by the time we compare that file was deleted or canceled"""
    routes.get_files.return_value = [f for f in remote if f.name != "same.mcap"]
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", fake_upload_files([files[0]]))

    result = kleinkram.core.upload(client=MagicMock(), query=QUERY, file_paths=files)

    assert result.unchecked == [files[0]]
    assert result.conflicts == []
