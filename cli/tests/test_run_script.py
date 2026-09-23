from __future__ import annotations

from pathlib import Path
from typing import Any
from typing import Dict
from uuid import uuid4

import pytest
from typer.testing import CliRunner

import kleinkram.core
import kleinkram.errors
from kleinkram.api.routes import _submit_script_action
from kleinkram.cli._action import RUNNER_DEPENDENCIES
from kleinkram.cli._action import action_typer

REQUIREMENTS = Path(__file__).resolve().parents[2] / "examples" / "kleinkram-actions" / "script-runner" / "requirements.txt"


def _write(tmp_path: Path, name: str, content: bytes) -> Path:
    path = tmp_path / name
    path.write_bytes(content)
    return path


def test_read_script_returns_the_source(tmp_path: Path) -> None:
    path = _write(tmp_path, "analyse.py", b"print('hi')\n")
    assert kleinkram.core._read_script(path) == "print('hi')\n"


@pytest.mark.parametrize(
    "name, content, message",
    [
        ("analyse.sh", b"echo hi", "not a Python file"),
        ("my script.py", b"print(1)", "not a usable script name"),
        ("empty.py", b"", "is empty"),
        ("binary.py", b"\xff\xfe\x00", "not valid UTF-8"),
        ("big.py", b"#" * (kleinkram.core.MAX_SCRIPT_BYTES + 1), "the limit is"),
    ],
)
def test_read_script_rejects_what_the_api_would(tmp_path: Path, name: str, content: bytes, message: str) -> None:
    path = _write(tmp_path, name, content)
    with pytest.raises(kleinkram.errors.ExecutionValidationError, match=message):
        kleinkram.core._read_script(path)


class _Response:
    def __init__(self, body: Dict[str, Any]) -> None:
        self._body = body

    def raise_for_status(self) -> None:
        pass

    def json(self) -> Dict[str, Any]:
        return self._body


class _Client:
    def __init__(self, body: Dict[str, Any]) -> None:
        self.body = body
        self.calls: list = []

    def post(self, url: str, json: Dict[str, Any]) -> _Response:
        self.calls.append((url, json))
        return _Response(self.body)


def test_submit_script_action_payload() -> None:
    action_uuid = uuid4()
    mission_uuid = uuid4()
    client = _Client({"actionUUID": str(action_uuid)})

    result = _submit_script_action(
        client,  # type: ignore[arg-type]
        mission_uuid,
        script="print(1)\n",
        filename="analyse.py",
        max_runtime_hours=0.5,
    )

    assert result == action_uuid
    assert client.calls == [
        (
            "/actions/script",
            {
                "missionUUID": str(mission_uuid),
                "script": "print(1)\n",
                "filename": "analyse.py",
                "maxRuntimeHours": 0.5,
            },
        )
    ]


def test_submit_script_action_omits_unset_runtime() -> None:
    client = _Client({"actionUUID": str(uuid4())})
    _submit_script_action(client, uuid4(), script="x = 1\n", filename="a.py")  # type: ignore[arg-type]
    assert "maxRuntimeHours" not in client.calls[0][1]


def test_submit_script_action_requires_an_action_uuid() -> None:
    with pytest.raises(KeyError):
        _submit_script_action(_Client({}), uuid4(), script="x = 1\n", filename="a.py")  # type: ignore[arg-type]


def test_run_script_command_converts_timeout_to_hours(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    script = _write(tmp_path, "analyse.py", b"print(1)\n")
    seen: Dict[str, Any] = {}
    execution = uuid4()

    def fake_run_script(**kwargs: Any) -> Any:
        seen.update(kwargs)
        return execution

    monkeypatch.setattr("kleinkram.cli._action.AuthenticatedClient", lambda: object())
    monkeypatch.setattr(kleinkram.core, "run_script", fake_run_script)

    result = CliRunner().invoke(
        action_typer,
        ["run-script", str(script), "-p", "proj", "-m", "mission", "--timeout", "30", "--no-follow"],
    )

    assert result.exit_code == 0, result.output
    assert str(execution) in result.output
    assert seen["max_runtime_hours"] == pytest.approx(0.5)
    assert seen["script_path"] == script


def test_run_script_command_rejects_non_positive_timeout(tmp_path: Path) -> None:
    script = _write(tmp_path, "analyse.py", b"print(1)\n")
    result = CliRunner().invoke(action_typer, ["run-script", str(script), "-m", "mission", "--timeout", "0"])
    assert result.exit_code != 0


def test_deps_lists_every_runner_dependency() -> None:
    result = CliRunner().invoke(action_typer, ["deps"])
    assert result.exit_code == 0
    for name, _ in RUNNER_DEPENDENCIES:
        assert name in result.output


@pytest.mark.skipif(not REQUIREMENTS.exists(), reason="runs from a repository checkout only")
def test_deps_matches_the_runner_image() -> None:
    lines = REQUIREMENTS.read_text().splitlines()
    required = {line.strip() for line in lines if line.strip() and not line.startswith("#")}
    assert required == {name for name, _ in RUNNER_DEPENDENCIES}
