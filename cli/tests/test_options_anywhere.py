"""\
`klein upload`, `klein download` and `klein verify` accept options before
and after the files, like most CLIs (GNU tools, git, cobra, clap); `--`
ends the options, see `kleinkram/cli/_context.py`
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner

import kleinkram.cli.app
from kleinkram.api.file_transfer import DownloadResult
from kleinkram.api.file_transfer import UploadResult
from kleinkram.cli.app import app


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    """skip the network and config side effects of the root callback, work in tmp_path"""
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")
    for module in ("_upload", "_verify", "_download"):
        monkeypatch.setattr(f"kleinkram.cli.{module}.AuthenticatedClient", MagicMock)
    monkeypatch.chdir(tmp_path)
    for name in ("a.bag", "b.bag", "-dash.bag"):
        (tmp_path / name).write_bytes(b"x")


@pytest.fixture
def upload(monkeypatch) -> MagicMock:
    mock = MagicMock(return_value=UploadResult(uploaded=1))
    monkeypatch.setattr("kleinkram.core.upload", mock)
    return mock


@pytest.fixture
def verify(monkeypatch) -> MagicMock:
    mock = MagicMock(return_value={})
    monkeypatch.setattr("kleinkram.core.verify", mock)
    monkeypatch.setattr("kleinkram.cli._verify.print_file_verification_status", MagicMock())
    return mock


@pytest.fixture
def download(monkeypatch) -> MagicMock:
    mock = MagicMock(return_value=DownloadResult())
    monkeypatch.setattr("kleinkram.core.download", mock)
    return mock


ANSI = re.compile(r"\x1b\[[0-9;]*m")


def invoke(runner: CliRunner, args: List[str]):
    # wide enough that rich does not wrap or truncate option names in help and errors
    return runner.invoke(app, ["--no-verbose", *args], env={"COLUMNS": "200"})


def plain(text: str) -> str:
    """without color codes: on CI (GITHUB_ACTIONS) Typer forces colors, which split `--creat` into `-` + `-creat`"""
    return ANSI.sub("", text)


def paths(mock: MagicMock) -> List[str]:
    return [str(p) for p in mock.call_args.kwargs["file_paths"]]


@pytest.mark.parametrize(
    "args",
    [
        ["-p", "p", "-m", "m", "--create", "a.bag", "b.bag"],  # options first, as before
        ["a.bag", "b.bag", "-p", "p", "-m", "m", "--create"],  # options last
        ["a.bag", "-p", "p", "b.bag", "--create", "-m", "m"],  # mixed
    ],
)
def test_upload_options_anywhere(runner, upload, args):
    result = invoke(runner, ["upload", *args])
    assert result.exit_code == 0, result.output
    assert paths(upload) == ["a.bag", "b.bag"]
    assert upload.call_args.kwargs["create"] is True
    assert upload.call_args.kwargs["query"].patterns == ["m"]


def test_upload_double_dash_ends_options(runner, upload):
    result = invoke(runner, ["upload", "-p", "p", "-m", "m", "a.bag", "--", "-dash.bag"])
    assert result.exit_code == 0, result.output
    assert paths(upload) == ["a.bag", "-dash.bag"]
    assert upload.call_args.kwargs["create"] is False


def test_upload_mistyped_option_is_not_taken_as_a_file(runner, upload):
    result = invoke(runner, ["upload", "a.bag", "-p", "p", "-m", "m", "--creat"])
    assert result.exit_code == 2
    assert "No such option: --creat" in plain(result.stderr)
    upload.assert_not_called()


def test_upload_help_after_files(runner, upload):
    result = invoke(runner, ["upload", "a.bag", "-h"])
    assert result.exit_code == 0, result.output
    assert "--create" in plain(result.stdout)
    upload.assert_not_called()


def test_verify_options_anywhere(runner, verify):
    result = invoke(runner, ["verify", "a.bag", "-p", "p", "-m", "m", "--no-check-file-hash", "b.bag"])
    assert result.exit_code == 0, result.output
    assert paths(verify) == ["a.bag", "b.bag"]
    assert verify.call_args.kwargs["check_file_hash"] is False


def test_download_options_anywhere(runner, download, tmp_path: Path):
    dest = tmp_path / "dest"
    dest.mkdir()
    result = invoke(runner, ["download", "a.bag", "*.mcap", "-p", "p", "-m", "m", "--dest", str(dest), "--nested"])
    assert result.exit_code == 0, result.output
    kwargs = download.call_args.kwargs
    assert kwargs["nested"] is True
    assert kwargs["base_dir"] == dest
    assert kwargs["query"].patterns == ["a.bag", "*.mcap"]
    assert kwargs["query"].mission_query.patterns == ["m"]
