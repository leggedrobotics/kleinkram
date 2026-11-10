"""Ctrl+C during uploads and downloads.

The library cleans up and then re-raises a plain `KeyboardInterrupt` carrying
the partial result, so SDK scripts stop; the CLI turns it into a summary and
exit code 130. No backend is needed: the per-file transfer functions are
replaced by fakes, and Ctrl+C is a real SIGINT to this process.
"""

from __future__ import annotations

import base64
import hashlib
import os
import signal
import subprocess
import sys
import threading
from datetime import datetime
from datetime import timezone
from pathlib import Path
from typing import Callable
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from typer.testing import CliRunner

import kleinkram.cli.app
from kleinkram.api import file_transfer
from kleinkram.api.file_transfer import DownloadResult
from kleinkram.api.file_transfer import DownloadState
from kleinkram.api.file_transfer import UploadResult
from kleinkram.api.file_transfer import UploadState
from kleinkram.api.file_transfer import download_file
from kleinkram.api.file_transfer import download_files
from kleinkram.api.file_transfer import upload_files
from kleinkram.cli._progress import run_interruptible
from kleinkram.cli.app import app
from kleinkram.errors import TransferCancelledError
from kleinkram.errors import get_transfer_result
from kleinkram.errors import transfer_interrupted
from kleinkram.models import File
from kleinkram.models import FileState
from kleinkram.utils import b64_md5

WAIT = 10  # seconds; only reached if cancellation is broken


def _remote_file(name: str, *, size: int = 0, hash_: str = "not-a-real-hash") -> File:
    now = datetime.now(timezone.utc)
    return File(
        id=uuid4(),
        name=name,
        hash=hash_,
        size=size,
        type_="MCAP",
        date=now,
        created_at=now,
        updated_at=now,
        mission_id=uuid4(),
        mission_name="mission",
        project_id=uuid4(),
        project_name="project",
        state=FileState.OK,
    )


def _ctrl_c() -> None:
    """What the terminal does on Ctrl+C: SIGINT, which Python raises in the main thread."""
    os.kill(os.getpid(), signal.SIGINT)


def _fake_transfer(first_done: threading.Event, done, canceled):
    """Per-file fake: a.mcap finishes, b.mcap presses Ctrl+C, and every file
    still running behaves like a transfer that notices `cancel_event`."""

    def transfer(*, path: Path, cancel_event: threading.Event, **_):
        if path.name == "a.mcap":
            return done
        if path.name == "b.mcap":
            assert first_done.wait(WAIT)  # let the main thread record a.mcap first
            _ctrl_c()
        assert cancel_event.wait(WAIT)
        return canceled

    return transfer


def _first_done_cb(first_done: threading.Event) -> Callable[[], None]:
    return first_done.set


def test_download_files_raises_keyboard_interrupt_with_partial_result(tmp_path: Path, monkeypatch) -> None:
    first_done = threading.Event()
    monkeypatch.setattr(
        file_transfer,
        "download_file",
        _fake_transfer(first_done, (DownloadState.DOWNLOADED_OK, 7), (DownloadState.CANCELED, 0)),
    )
    files = {tmp_path / name: _remote_file(name) for name in ("a.mcap", "b.mcap", "c.mcap")}

    with pytest.raises(KeyboardInterrupt) as excinfo:
        download_files(MagicMock(), files, n_workers=2, on_overall_progress_cb=_first_done_cb(first_done))

    assert type(excinfo.value) is KeyboardInterrupt  # exact type: see test_uncaught_*
    result = get_transfer_result(excinfo.value)
    assert isinstance(result, DownloadResult)
    # a finished; b noticed the cancel; c was queued and never started (or saw the cancel)
    assert result.state_counts == {DownloadState.DOWNLOADED_OK: 1, DownloadState.CANCELED: 2}
    assert result.total_bytes == 7


def test_upload_files_raises_keyboard_interrupt_with_partial_result(tmp_path: Path, monkeypatch) -> None:
    first_done = threading.Event()
    monkeypatch.setattr(
        file_transfer,
        "upload_file",
        _fake_transfer(first_done, (UploadState.UPLOADED, 5), (UploadState.CANCELED, 0)),
    )
    files = {}
    for name in ("a.mcap", "b.mcap", "c.mcap"):
        (tmp_path / name).write_bytes(b"x")
        files[name] = tmp_path / name

    with pytest.raises(KeyboardInterrupt) as excinfo:
        upload_files(MagicMock(), files, uuid4(), n_workers=2, on_overall_progress_cb=_first_done_cb(first_done))

    assert type(excinfo.value) is KeyboardInterrupt  # exact type: see test_uncaught_*
    result = get_transfer_result(excinfo.value)
    assert isinstance(result, UploadResult)
    assert (result.uploaded, result.canceled, result.failed, result.total_bytes) == (1, 2, 0, 5)


def test_uncaught_interrupt_exits_like_ctrl_c() -> None:
    """A script that does not catch it must die of SIGINT (exit 130), like any Ctrl+C.

    CPython only does that for the exact `KeyboardInterrupt` type; a subclass
    exits with 1, and a shell loop around the script would keep going.
    """
    code = (
        "from kleinkram.errors import transfer_interrupted\n"
        "from kleinkram.api.file_transfer import DownloadResult\n"
        "raise transfer_interrupted(DownloadResult())\n"
    )
    proc = subprocess.run([sys.executable, "-c", code], capture_output=True)
    assert proc.returncode in (130, -signal.SIGINT), proc.stderr


def test_run_interruptible_returns_partial_result_and_reraises_plain_ctrl_c() -> None:
    partial = DownloadResult(failed=1)

    def interrupted():
        raise transfer_interrupted(partial)

    assert run_interruptible(interrupted) == (partial, True)
    assert run_interruptible(lambda: partial) == (partial, False)

    def plain_ctrl_c():
        raise KeyboardInterrupt

    with pytest.raises(KeyboardInterrupt):
        run_interruptible(plain_ctrl_c)


def test_transfers_without_ctrl_c_return_normally(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(file_transfer, "download_file", lambda **_: (DownloadState.DOWNLOADED_OK, 1))
    result = download_files(MagicMock(), {tmp_path / "a.mcap": _remote_file("a.mcap")})
    assert result.state_counts == {DownloadState.DOWNLOADED_OK: 1}


def test_b64_md5_matches_hashlib_and_stops_on_cancel(tmp_path: Path) -> None:
    path = tmp_path / "f.bin"
    data = os.urandom(3 * 1024 * 1024 + 17)
    path.write_bytes(data)

    assert b64_md5(path) == base64.b64encode(hashlib.md5(data).digest()).decode()
    assert b64_md5(path, cancel_event=threading.Event()) == b64_md5(path)

    cancel_event = threading.Event()
    cancel_event.set()
    with pytest.raises(TransferCancelledError):
        b64_md5(path, cancel_event=cancel_event)


def test_download_file_cancel_while_checking_local_copy_leaves_it(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "a.mcap"
    path.write_bytes(b"local copy")
    monkeypatch.setattr(file_transfer, "_get_file_download", MagicMock(side_effect=AssertionError("must not fetch")))
    cancel_event = threading.Event()

    def hash_then_ctrl_c(p: Path, cancel_event: threading.Event) -> str:
        cancel_event.set()
        raise TransferCancelledError("Transfer cancelled by user")

    # The pre-download check passes the cancel event through; it is set while hashing.
    monkeypatch.setattr(file_transfer, "b64_md5", hash_then_ctrl_c)

    state = download_file(
        MagicMock(),
        file=_remote_file("a.mcap", size=path.stat().st_size),
        path=path,
        overwrite=True,
        cancel_event=cancel_event,
    )

    assert state == (DownloadState.CANCELED, 0)
    assert path.read_bytes() == b"local copy"


def test_download_file_cancel_while_verifying_keeps_the_finished_file(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "a.mcap"
    cancel_event = threading.Event()
    monkeypatch.setattr(file_transfer, "_get_file_download", lambda client, file_id: "http://unused")

    def finished_download(url, *, path: Path, **_):
        path.write_bytes(b"complete")
        cancel_event.set()  # Ctrl+C lands right after the last byte

    monkeypatch.setattr(file_transfer, "_url_download", finished_download)

    state = download_file(MagicMock(), file=_remote_file("a.mcap", size=8), path=path, cancel_event=cancel_event)

    # The bytes are all there; the next run verifies them instead of fetching again.
    assert state == (DownloadState.CANCELED, 0)
    assert path.read_bytes() == b"complete"


def test_upload_file_cancel_while_hashing_cancels_on_server(tmp_path: Path, monkeypatch) -> None:
    path = tmp_path / "a.mcap"
    path.write_bytes(b"x" * 10)
    cancel_event = threading.Event()
    creds = file_transfer.UploadCredentials("k", "s", "t", uuid4(), "bucket")
    monkeypatch.setattr(file_transfer, "_get_upload_creditials", lambda *a, **k: creds)
    monkeypatch.setattr(file_transfer, "_s3_upload", lambda *a, **k: cancel_event.set())
    confirm = MagicMock()
    cancel = MagicMock()
    monkeypatch.setattr(file_transfer, "_confirm_file_upload", confirm)
    monkeypatch.setattr(file_transfer, "_cancel_file_upload", cancel)
    mission_id = uuid4()

    state = file_transfer.upload_file(
        MagicMock(),
        mission_id=mission_id,
        filename="a.mcap",
        path=path,
        s3_endpoint="http://unused",
        cancel_event=cancel_event,
    )

    assert state == (UploadState.CANCELED, 0)
    confirm.assert_not_called()
    cancel.assert_called_once()
    assert cancel.call_args.args[1:] == (creds.file_id, mission_id)


# --- CLI ----------------------------------------------------------------------


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture(autouse=True)
def offline_root(monkeypatch, tmp_path):
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")


def _interrupted(result) -> MagicMock:
    return MagicMock(side_effect=transfer_interrupted(result))


@pytest.mark.parametrize("verbose", ["--verbose", "--no-verbose"])
def test_cli_download_prints_summary_and_exits_130(runner, monkeypatch, tmp_path, verbose) -> None:
    partial = DownloadResult(state_counts={DownloadState.DOWNLOADED_OK: 1, DownloadState.CANCELED: 3})
    monkeypatch.setattr("kleinkram.cli._download.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.download", _interrupted(partial))

    res = runner.invoke(app, [verbose, "download", "-p", "p1", "-m", "m1", "--dest", str(tmp_path)])

    assert res.exit_code == 130, res.output
    out = res.output + res.stderr
    assert "3 canceled" in out
    assert "Traceback" not in out


@pytest.mark.parametrize("verbose", ["--verbose", "--no-verbose"])
def test_cli_upload_prints_summary_and_exits_130(runner, monkeypatch, tmp_path, verbose) -> None:
    bag = tmp_path / "a.bag"
    bag.write_bytes(b"")
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.upload", _interrupted(UploadResult(uploaded=2, canceled=1)))

    res = runner.invoke(app, [verbose, "upload", "-p", "p1", "-m", "m1", str(bag)])

    assert res.exit_code == 130, res.output
    out = res.output + res.stderr
    assert "Uploaded 2 file" in out and "1 canceled" in out
    assert "Traceback" not in out


def test_cli_download_without_ctrl_c_exits_0(runner, monkeypatch, tmp_path) -> None:
    monkeypatch.setattr("kleinkram.cli._download.AuthenticatedClient", MagicMock)
    monkeypatch.setattr(
        "kleinkram.core.download",
        MagicMock(return_value=DownloadResult(state_counts={DownloadState.DOWNLOADED_OK: 2})),
    )

    res = runner.invoke(app, ["--no-verbose", "download", "-p", "p1", "-m", "m1", "--dest", str(tmp_path)])

    assert res.exit_code == 0, res.output


def test_upload_that_finishes_after_ctrl_c_is_counted_as_uploaded(tmp_path: Path, monkeypatch) -> None:
    """A worker past its last cancel check still confirms its upload; the summary must say so."""
    first_done = threading.Event()

    def transfer(*, path: Path, cancel_event: threading.Event, **_):
        if path.name == "a.mcap":
            return UploadState.UPLOADED, 5
        assert first_done.wait(WAIT)
        _ctrl_c()
        assert cancel_event.wait(WAIT)
        return UploadState.UPLOADED, 3  # e.g. hashing had just finished, so it was confirmed

    monkeypatch.setattr(file_transfer, "upload_file", transfer)
    files = {}
    for name in ("a.mcap", "b.mcap"):
        (tmp_path / name).write_bytes(b"x")
        files[name] = tmp_path / name

    with pytest.raises(KeyboardInterrupt) as excinfo:
        upload_files(MagicMock(), files, uuid4(), n_workers=2, on_overall_progress_cb=first_done.set)

    result = get_transfer_result(excinfo.value)
    assert (result.uploaded, result.canceled, result.total_bytes) == (2, 0, 8)


@pytest.mark.parametrize("kind", ["upload", "download"])
def test_ctrl_c_inside_a_result_callback_counts_the_file_once(tmp_path: Path, monkeypatch, kind: str) -> None:
    def message_cb(msg: str, _is_error: bool) -> None:
        if msg.startswith(("uploaded", "downloaded")):
            raise KeyboardInterrupt  # Ctrl+C while the CLI prints the line for a.mcap

    if kind == "upload":
        monkeypatch.setattr(file_transfer, "upload_file", lambda **_: (UploadState.UPLOADED, 5))
        (tmp_path / "a.mcap").write_bytes(b"x")
        with pytest.raises(KeyboardInterrupt) as excinfo:
            upload_files(MagicMock(), {"a.mcap": tmp_path / "a.mcap"}, uuid4(), n_workers=1, on_message_cb=message_cb)
        result = get_transfer_result(excinfo.value)
        assert (result.uploaded, result.canceled, result.total_bytes) == (1, 0, 5)
    else:
        monkeypatch.setattr(file_transfer, "download_file", lambda **_: (DownloadState.DOWNLOADED_OK, 7))
        files = {tmp_path / "a.mcap": _remote_file("a.mcap")}
        with pytest.raises(KeyboardInterrupt) as excinfo:
            download_files(MagicMock(), files, n_workers=1, on_message_cb=message_cb)
        result = get_transfer_result(excinfo.value)
        assert result.state_counts == {DownloadState.DOWNLOADED_OK: 1}
        assert result.total_bytes == 7


def test_overwrite_download_cancelled_before_it_starts_keeps_existing_file(tmp_path: Path, monkeypatch) -> None:
    """Ctrl+C while the download URL is requested must not delete the file being overwritten."""
    path = tmp_path / "a.mcap"
    path.write_bytes(b"old contents")
    cancel_event = threading.Event()

    def get_url(*_args, **_kwargs) -> str:
        cancel_event.set()
        return "http://unused.invalid/a.mcap"

    monkeypatch.setattr(file_transfer, "_get_file_download", get_url)
    stream = MagicMock(side_effect=AssertionError("no request after cancel"))
    monkeypatch.setattr(file_transfer.httpx, "stream", stream)

    state, size = download_file(
        MagicMock(), file=_remote_file("a.mcap", size=99), path=path, overwrite=True, cancel_event=cancel_event
    )

    assert (state, size) == (DownloadState.CANCELED, 0)
    assert path.read_bytes() == b"old contents"
    stream.assert_not_called()
