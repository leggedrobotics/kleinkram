"""\
`klein upload`, `klein download` and `klein verify` exit with 0 only if every
requested file was handled, 1 if any was not, 130 on Ctrl+C. The exit code
does not depend on --verbose / --no-verbose, and --no-verbose still names
every problem on stderr. See `kleinkram/cli/_exit_codes.py` (core mocked).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any
from typing import Callable
from typing import Dict
from typing import List
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner

import kleinkram.cli.app
from kleinkram.api.file_transfer import DownloadResult
from kleinkram.api.file_transfer import DownloadState
from kleinkram.api.file_transfer import UploadResult
from kleinkram.cli.app import app
from kleinkram.errors import transfer_interrupted
from kleinkram.models import FileVerificationStatus

MODES = ["--verbose", "--no-verbose"]


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture(autouse=True)
def offline(monkeypatch, tmp_path):
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")
    for module in ("_upload", "_verify", "_download"):
        monkeypatch.setattr(f"kleinkram.cli.{module}.AuthenticatedClient", MagicMock)
    monkeypatch.chdir(tmp_path)
    for name in ("a.bag", "b.bag"):
        (tmp_path / name).write_bytes(b"x")
    (tmp_path / "dest").mkdir()


def fake(result: Any, messages: List[tuple] = ()) -> Callable[..., Any]:
    """a core function that sends `messages` to the message callback and returns `result`"""

    def run(**kwargs: Any) -> Any:
        callback = kwargs.get("on_message_cb")
        if callback is not None:
            for message, is_error in messages:
                callback(message, is_error)
        if isinstance(result, BaseException):
            raise result
        return result

    return run


# --------------------------------------------------------------------------
# upload
# --------------------------------------------------------------------------


def upload(runner, monkeypatch, mode: str, result: Any, messages: List[tuple] = ()):
    monkeypatch.setattr("kleinkram.core.upload", fake(result, messages))
    return runner.invoke(app, [mode, "upload", "-p", "p", "-m", "m", "a.bag", "b.bag"])


@pytest.mark.parametrize("mode", MODES)
def test_upload_all_done_exits_0(runner, monkeypatch, mode):
    result = upload(runner, monkeypatch, mode, UploadResult(uploaded=2))
    assert result.exit_code == 0, result.output


@pytest.mark.parametrize("mode", MODES)
def test_upload_identical_existing_file_exits_0(runner, monkeypatch, mode, tmp_path):
    result = upload(runner, monkeypatch, mode, UploadResult(uploaded=1, skipped=1, existing=[tmp_path / "a.bag"]))
    assert result.exit_code == 0, result.output


@pytest.mark.parametrize("mode", MODES)
def test_upload_failed_file_exits_1_and_is_named(runner, monkeypatch, mode):
    messages = [("uploaded a.bag", False), ("Error uploading b.bag: connection reset", True)]
    result = upload(runner, monkeypatch, mode, UploadResult(uploaded=1, failed=1), messages)

    assert result.exit_code == 1, result.output
    assert "Error uploading b.bag: connection reset" in result.stderr
    assert "1 failed" in result.stderr


def test_upload_quiet_mode_hides_success_lines(runner, monkeypatch):
    messages = [("uploaded a.bag", False), ("Error uploading b.bag: boom", True)]
    result = upload(runner, monkeypatch, "--no-verbose", UploadResult(uploaded=1, failed=1), messages)
    assert "uploaded a.bag" not in result.stderr + result.stdout
    assert "Error uploading b.bag: boom" in result.stderr


@pytest.mark.parametrize("mode", MODES)
def test_upload_ctrl_c_exits_130(runner, monkeypatch, mode):
    result = upload(runner, monkeypatch, mode, transfer_interrupted(UploadResult(uploaded=1, canceled=1)))
    assert result.exit_code == 130, result.output


# --------------------------------------------------------------------------
# download
# --------------------------------------------------------------------------


def download(runner, monkeypatch, mode: str, result: Any, messages: List[tuple] = ()):
    monkeypatch.setattr("kleinkram.core.download", fake(result, messages))
    return runner.invoke(app, [mode, "download", "-p", "p", "-m", "m", "--dest", "dest", "*"])


def counts(**states: int) -> Dict[DownloadState, int]:
    return {DownloadState[name]: n for name, n in states.items()}


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    "states",
    [
        {"DOWNLOADED_OK": 2},
        {"DOWNLOADED_OK": 1, "SKIPPED_OK": 1},  # already present with the right hash
        {"OVERWRITTEN_OK": 1, "DOWNLOADED_PARTIAL": 1},
        {"DOWNLOADED_PARTIAL": 1, "SKIPPED_NOT_SLICEABLE": 1},  # documented: only .mcap can be sliced
        {"DOWNLOADED_CORRUPTED": 1, "SKIPPED_CORRUPTED_LOCAL_OK": 1},  # explicitly allowed / already there
    ],
)
def test_download_all_done_exits_0(runner, monkeypatch, mode, states):
    result = download(runner, monkeypatch, mode, DownloadResult(state_counts=counts(**states)))
    assert result.exit_code == 0, result.output
    assert "NOT downloaded" not in result.stderr


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    "states",
    [
        {"SKIPPED_INVALID_HASH": 1},
        {"SKIPPED_FILE_SIZE_MISMATCH": 1},
        {"SKIPPED_INVALID_REMOTE_STATE": 1},
        {"SKIPPED_CORRUPTED": 1},
        {"SKIPPED_SLICE_EXISTS": 1},
        {"DOWNLOADED_INVALID_HASH": 1},
    ],
)
def test_download_not_done_exits_1(runner, monkeypatch, mode, states):
    result = download(
        runner, monkeypatch, mode, DownloadResult(state_counts={DownloadState.DOWNLOADED_OK: 1, **counts(**states)})
    )
    assert result.exit_code == 1, result.output
    assert "NOT downloaded" in result.stderr
    assert "Successfully" not in result.stdout


@pytest.mark.parametrize("mode", MODES)
def test_download_failed_file_exits_1_and_is_named(runner, monkeypatch, mode):
    messages = [("downloaded a.bag", False), ("Error downloading b.bag: timeout", True)]
    result = download(runner, monkeypatch, mode, DownloadResult(state_counts=counts(DOWNLOADED_OK=1), failed=1), messages)
    assert result.exit_code == 1, result.output
    assert "Error downloading b.bag: timeout" in result.stderr


def test_download_quiet_mode_names_skipped_files(runner, monkeypatch):
    messages = [
        ("downloaded a.bag", False),
        ("skipped b.bag, exists with hash mismatch (use --overwrite?)", True),
    ]
    result = download(
        runner,
        monkeypatch,
        "--no-verbose",
        DownloadResult(state_counts=counts(DOWNLOADED_OK=1, SKIPPED_INVALID_HASH=1)),
        messages,
    )
    assert result.exit_code == 1
    assert "skipped b.bag, exists with hash mismatch" in result.stderr
    assert "downloaded a.bag" not in result.stderr + result.stdout
    assert "Downloaded 1 file(s), 1 NOT downloaded." in result.stderr


def test_download_ctrl_c_exits_130(runner, monkeypatch):
    interrupted = transfer_interrupted(DownloadResult(state_counts=counts(DOWNLOADED_OK=1, CANCELED=1)))
    result = download(runner, monkeypatch, "--no-verbose", interrupted)
    assert result.exit_code == 130, result.output


# --------------------------------------------------------------------------
# verify
# --------------------------------------------------------------------------


def verify(runner, monkeypatch, mode: str, statuses: Dict[str, FileVerificationStatus]):
    file_status = {Path(name): status for name, status in statuses.items()}
    monkeypatch.setattr("kleinkram.core.verify", MagicMock(return_value=file_status))
    return runner.invoke(app, [mode, "verify", "-p", "p", "-m", "m", "a.bag", "b.bag"], env={"COLUMNS": "200"})


@pytest.mark.parametrize("mode", MODES)
def test_verify_all_uploaded_exits_0(runner, monkeypatch, mode):
    ok = FileVerificationStatus.UPLOADED
    result = verify(runner, monkeypatch, mode, {"a.bag": ok, "b.bag": ok})
    assert result.exit_code == 0, result.output


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize(
    "status",
    [
        FileVerificationStatus.MISSING,
        FileVerificationStatus.MISMATCHED_HASH,
        FileVerificationStatus.MISMATCHED_SIZE,
        FileVerificationStatus.UNKNOWN,
    ],
)
def test_verify_problem_exits_1(runner, monkeypatch, mode, status):
    result = verify(runner, monkeypatch, mode, {"a.bag": FileVerificationStatus.UPLOADED, "b.bag": status})
    assert result.exit_code == 1, result.output
    assert "1 of 2 file(s) could not be verified." in result.stderr
    # named on stderr in both modes, so `klein verify ... > verified.txt` still shows which file
    assert f"{status.value}: b.bag" in result.stderr.splitlines()


@pytest.mark.parametrize("status", [FileVerificationStatus.UPLOADING, FileVerificationStatus.COMPUTING_HASH])
def test_verify_still_processing_exits_1_and_says_retry(runner, monkeypatch, status):
    result = verify(runner, monkeypatch, "--no-verbose", {"a.bag": status})
    assert result.exit_code == 1, result.output
    assert "run `klein verify` again later" in result.stderr


def test_verify_quiet_mode_output(runner, monkeypatch):
    result = verify(
        runner,
        monkeypatch,
        "--no-verbose",
        {"a.bag": FileVerificationStatus.UPLOADED, "b.bag": FileVerificationStatus.MISMATCHED_HASH},
    )
    assert result.stdout.splitlines() == ["a.bag"]  # verified paths only, for piping
    assert "hash mismatch: b.bag" in result.stderr.splitlines()
