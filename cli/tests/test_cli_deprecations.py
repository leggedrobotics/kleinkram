"""\
the deprecated CLI syntax must keep working (with a warning on stderr) until
`REMOVED_IN`; each test invokes the new and the old syntax and checks that
both reach the backend with the same arguments
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from typing import Dict
from typing import List
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from typer.testing import CliRunner

import kleinkram.cli.app
from kleinkram.cli._deprecation import REMOVED_IN
from kleinkram.cli._deprecation import prefer_new
from kleinkram.cli.app import app
from kleinkram.errors import InvalidFileQuery
from kleinkram.utils import get_supported_api_version

DEPRECATED = "is deprecated"


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture(autouse=True)
def offline_root(monkeypatch, tmp_path):
    """skip the network and config side effects of the root callback"""
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")


def invoke(runner: CliRunner, args: List[str]):
    return runner.invoke(app, ["--no-verbose", *args])


def kwargs_without_client(mock: MagicMock) -> List[Dict[str, Any]]:
    return [{k: v for k, v in call.kwargs.items() if k != "client"} for call in mock.call_args_list]


def test_deprecated_cli_forms_are_removed_by_their_deadline():
    removed_in = tuple(map(int, REMOVED_IN.split(".")))
    assert get_supported_api_version() < removed_in, (
        f"kleinkram {REMOVED_IN} was promised to drop the deprecated CLI syntax, "
        "remove it (see kleinkram/cli/_deprecation.py) and this test"
    )


def test_prefer_new():
    assert prefer_new("a", None, old="--old", new="NEW") == "a"
    assert prefer_new(None, "a", old="--old", new="NEW") == "a"
    assert prefer_new("a", "a", old="--old", new="NEW") == "a"
    assert prefer_new(None, None, old="--old", new="NEW") is None


@pytest.fixture
def mission_calls(monkeypatch) -> List[Any]:
    calls: List[Any] = []
    mission = SimpleNamespace(id=uuid4(), name="m1", project_name="p1")

    def get_mission(_client, query, **_):
        calls.append(query)
        return mission

    monkeypatch.setattr("kleinkram.cli._mission.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.cli._mission.get_mission", get_mission)
    monkeypatch.setattr("kleinkram.cli._mission.print_mission_info", MagicMock())
    monkeypatch.setattr("kleinkram.core.delete_mission", MagicMock())
    return calls


def test_mission_info_positional_and_legacy_flag(runner, mission_calls):
    new = invoke(runner, ["mission", "info", "m1", "-p", "p1"])
    old = invoke(runner, ["mission", "info", "-m", "m1", "-p", "p1"])

    assert new.exit_code == 0, new.output
    assert old.exit_code == 0, old.output
    assert mission_calls[0] == mission_calls[1]
    assert DEPRECATED not in new.stderr
    assert DEPRECATED in old.stderr


def test_new_and_legacy_syntax_must_not_disagree(runner, mission_calls):
    result = invoke(runner, ["mission", "info", "m1", "-m", "m2", "-p", "p1"])

    assert result.exit_code == 2
    assert not mission_calls


def test_missing_positional_is_a_usage_error(runner, mission_calls):
    result = invoke(runner, ["mission", "info", "-p", "p1"])

    assert result.exit_code == 2
    assert "MISSION" in result.stderr


def test_mission_delete_requires_yes_when_not_interactive(runner, mission_calls):
    import kleinkram.core

    refused = invoke(runner, ["mission", "delete", "m1", "-p", "p1"])
    assert refused.exit_code != 0
    kleinkram.core.delete_mission.assert_not_called()

    legacy = invoke(runner, ["mission", "delete", "-m", "m1", "-p", "p1", "--confirm"])
    assert legacy.exit_code == 0, legacy.output
    assert DEPRECATED in legacy.stderr

    new = invoke(runner, ["mission", "delete", "m1", "-p", "p1", "-y"])
    assert new.exit_code == 0, new.output
    assert kleinkram.core.delete_mission.call_count == 2


def test_project_delete_keeps_deleting_without_yes_in_scripts_for_now(runner, monkeypatch):
    project = SimpleNamespace(id=uuid4(), name="p1")
    delete_project = MagicMock()
    monkeypatch.setattr("kleinkram.cli._project.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.cli._project.get_project", lambda **_: project)
    monkeypatch.setattr("kleinkram.core.delete_project", delete_project)

    legacy = invoke(runner, ["project", "delete", "-p", "p1"])

    assert legacy.exit_code == 0, legacy.output
    assert "--project/-p is deprecated" in legacy.stderr
    assert "deleting without --yes" in legacy.stderr
    delete_project.assert_called_once_with(client=delete_project.call_args.kwargs["client"], project_id=project.id)


def test_file_delete_accepts_several_files(runner, monkeypatch):
    queried: List[Any] = []

    def get_file(_client, query, **_):
        queried.append(query)
        return SimpleNamespace(id=uuid4(), name=query.patterns[0], mission_name="m1", project_name="p1")

    delete_files = MagicMock()
    monkeypatch.setattr("kleinkram.cli._file.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.cli._file.get_file", get_file)
    monkeypatch.setattr("kleinkram.core.delete_files", delete_files)

    new = invoke(runner, ["file", "delete", "a.bag", "b.bag", "-m", "m1", "-p", "p1", "-y"])
    assert new.exit_code == 0, new.output
    assert [q.patterns for q in queried] == [["a.bag"], ["b.bag"]]
    assert len(delete_files.call_args.kwargs["file_ids"]) == 2

    old = invoke(runner, ["file", "delete", "-f", "a.bag", "-m", "m1", "-p", "p1", "-y"])
    assert old.exit_code == 0, old.output
    assert DEPRECATED in old.stderr
    assert queried[2] == queried[0]


@pytest.mark.parametrize("name", ["", "*", "*.bag"])
def test_file_delete_never_expands_to_several_files(runner, monkeypatch, name):
    delete_files = MagicMock()
    list_files = MagicMock(return_value=iter([]))
    monkeypatch.setattr("kleinkram.cli._file.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.api.routes.get_files", list_files)
    monkeypatch.setattr("kleinkram.core.delete_files", delete_files)

    result = invoke(runner, ["file", "delete", name, "-m", "m1", "-p", "p1", "-y"])

    assert result.exit_code != 0
    assert isinstance(result.exception, InvalidFileQuery)
    list_files.assert_not_called()
    delete_files.assert_not_called()


def test_execution_launch_takes_mission_as_option(runner, monkeypatch):
    launches: List[Dict[str, Any]] = []

    def launch_execution(**kwargs):
        launches.append(kwargs)
        return uuid4()

    monkeypatch.setattr("kleinkram.cli._executions.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.launch_execution", launch_execution)

    new = invoke(runner, ["execution", "launch", "tmpl", "-m", "m1", "-p", "p1"])
    old = invoke(runner, ["executions", "launch", "tmpl", "m1", "-p", "p1"])

    assert new.exit_code == 0, new.output
    assert old.exit_code == 0, old.output
    assert launches[0]["mission_query"] == launches[1]["mission_query"]
    assert launches[0]["template"] == launches[1]["template"] == "tmpl"
    assert "`klein executions` is deprecated" in old.stderr
    assert "positional MISSION argument is deprecated" in old.stderr


def test_execution_list_accepts_names_and_legacy_uuid_flags(runner, monkeypatch):
    project = SimpleNamespace(id=uuid4())
    get_executions = MagicMock(return_value=[])
    monkeypatch.setattr("kleinkram.cli._executions.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.api.routes.get_project", lambda *_, **__: project)
    monkeypatch.setattr("kleinkram.api.routes.get_executions", get_executions)

    new = invoke(runner, ["execution", "list", "-p", "p1", "-t", "tmpl"])
    old = invoke(runner, ["execution", "list", "--project-uuid", str(project.id), "--template-name", "tmpl"])

    assert new.exit_code == 0, new.output
    assert old.exit_code == 0, old.output
    first, second = (c.kwargs["query"] for c in get_executions.call_args_list)
    assert first == second
    assert first.project_uuid == project.id


def test_template_create_name_and_cpu_memory(runner, monkeypatch):
    create_template = MagicMock(return_value=uuid4())
    monkeypatch.setattr("kleinkram.cli._templates.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.create_template", create_template)
    monkeypatch.setattr("kleinkram.api.routes.get_template", MagicMock())
    monkeypatch.setattr("kleinkram.cli._templates.print_templates_table", MagicMock())

    new = invoke(runner, ["template", "create", "t1", "-d", "desc", "-i", "img", "--cpu-memory", "4"])
    old = invoke(runner, ["templates", "create", "-n", "t1", "-d", "desc", "-i", "img", "-m", "4"])
    default = invoke(runner, ["template", "create", "t1", "-d", "desc", "-i", "img"])

    assert new.exit_code == 0, new.output
    assert old.exit_code == 0, old.output
    assert default.exit_code == 0, default.output
    first, second, third = kwargs_without_client(create_template)
    assert first == second
    assert first["name"] == "t1"
    assert first["cpu_memory_gb"] == 4
    assert third["cpu_memory_gb"] == 1


def test_trigger_create_resolves_names_and_keeps_legacy_flags(runner, monkeypatch):
    template_id, mission_id = uuid4(), uuid4()
    create_trigger = MagicMock(return_value=uuid4())
    monkeypatch.setattr("kleinkram.cli._triggers.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.resolve_template", lambda _client, _template: template_id)
    monkeypatch.setattr("kleinkram.cli._triggers._resolve_mission", lambda _client, _mission, _project: mission_id)
    monkeypatch.setattr("kleinkram.core.create_trigger", create_trigger)

    common = ["-t", "tmpl", "-m", "m1", "--cron", "0 * * * *"]
    new = invoke(runner, ["trigger", "create", "trig", "--type", "TIME", *common])
    old = invoke(runner, ["triggers", "create", "--name", "trig", "-y", "TIME", *common])

    assert new.exit_code == 0, new.output
    assert old.exit_code == 0, old.output
    first, second = kwargs_without_client(create_trigger)
    assert first == second
    assert first["template_uuid"] == template_id
    assert first["mission_uuid"] == mission_id


def test_legacy_list_group_warns(runner, monkeypatch):
    monkeypatch.setattr("kleinkram.cli._project.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.cli._project.get_projects", lambda *_, **__: iter([]))
    monkeypatch.setattr("kleinkram.cli._project.print_projects", MagicMock())

    result = invoke(runner, ["list", "projects"])

    assert result.exit_code == 0, result.output
    assert "`klein project list`" in result.stderr


def test_help_hides_deprecated_syntax(runner):
    root = invoke(runner, ["--help"])
    launch = invoke(runner, ["execution", "launch", "--help"])
    info = invoke(runner, ["mission", "info", "--help"])

    commands = [line.split()[1] for line in root.stdout.splitlines() if line.startswith("│ ") and len(line.split()) > 1]
    assert {"template", "execution", "trigger"} <= set(commands)
    assert not {"templates", "executions", "triggers"} & set(commands)
    assert "execution launch [OPTIONS] TEMPLATE" in launch.stdout
    assert "MISSION" not in launch.stdout.split("Arguments")[0]
    assert "mission info [OPTIONS] MISSION" in info.stdout
    assert "--mission" not in info.stdout


def test_only_deletion_resolves_its_target_strictly(runner, monkeypatch):
    strict_flags = {}
    entity = SimpleNamespace(id=uuid4(), name="x", project_name="p1", mission_name="m1")

    def recorder(kind):
        def lookup(*_, strict=False, **__):
            strict_flags.setdefault(kind, []).append(strict)
            return entity

        return lookup

    for module in ("_project", "_mission", "_file"):
        monkeypatch.setattr(f"kleinkram.cli.{module}.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.cli._project.get_project", recorder("project"))
    monkeypatch.setattr("kleinkram.cli._mission.get_mission", recorder("mission"))
    monkeypatch.setattr("kleinkram.cli._file.get_file", recorder("file"))
    for printer in ("_project.print_project_info", "_mission.print_mission_info", "_file.print_file_info"):
        monkeypatch.setattr(f"kleinkram.cli.{printer}", MagicMock())
    for delete in ("delete_project", "delete_mission", "delete_files"):
        monkeypatch.setattr(f"kleinkram.core.{delete}", MagicMock())

    for kind, extra in (("project", []), ("mission", ["-p", "p1"]), ("file", ["-m", "m1", "-p", "p1"])):
        assert invoke(runner, [kind, "info", "x", *extra]).exit_code == 0
        assert invoke(runner, [kind, "delete", "x", *extra, "-y"]).exit_code == 0

    assert strict_flags == {"project": [False, True], "mission": [False, True], "file": [False, True]}
