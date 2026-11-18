from __future__ import annotations

import os
import re
import secrets
import shutil
import subprocess
import time
from pathlib import Path

import pytest
from rich.console import Console
from rich.text import Text

import kleinkram.wrappers
from kleinkram.api.routes import _get_api_version

VERBOSE = True

CLI = "klein"
PROJECT_NAME = "automated-testing"
DATA_PATH = Path(__file__).parent / "data"


@pytest.fixture(scope="session")
def api():
    try:
        _get_api_version()
        return True
    except Exception:
        print("API is not available")
        return False


def run_cmd(command, *, verbose=VERBOSE):
    msg = ("\n", "#" * 50, "\n\n", "running command:", Text(command, style="bold"))
    Console().print(*msg)

    if not verbose:
        command += ">/dev/null 2>&1"
    ret = os.system(command)
    Console().print("got return code:", ret, style="bold red")
    return ret


@pytest.mark.slow
def test_upload_verify_update_download_mission(project, tmp_path, api):
    assert api

    file_names = list(DATA_PATH.glob("*.bag"))

    mission_name = secrets.token_hex(8)
    upload = f"{CLI} upload -p {project.name} -m {mission_name} --create {DATA_PATH.absolute()}/*.bag"
    verify = f"{CLI} verify -p {project.name} -m {mission_name} {DATA_PATH.absolute()}/*.bag"
    # update = f"{CLI} mission update {mission_name} -p {project.name} --metadata {DATA_PATH.absolute()}/metadata.yaml"
    download = f"{CLI} download -p {project.name} -m {mission_name} --dest {tmp_path.absolute()}"
    delete_file = f"{CLI} file delete {file_names[0].name} -p {project.name} -m {mission_name} -y"

    assert run_cmd(upload) == 0
    assert run_cmd(verify) == 0
    # assert run_cmd(update) == 0
    assert run_cmd(download) == 0

    assert run_cmd(delete_file) == 0


@pytest.mark.slow
def test_list_files(project, mission, api):
    assert api
    # Legacy commands
    assert run_cmd(f"{CLI} list files -p {project.name}") == 0
    assert run_cmd(f"{CLI} list files -p {project.name} -m {mission.name}") == 0
    assert run_cmd(f"{CLI} list files") == 0
    assert run_cmd(f"{CLI} list files -p {project.name}") == 0
    assert run_cmd(f'{CLI} list files -p "*" -m "*" "*"') == 0

    # New commands
    assert run_cmd(f"{CLI} file list -p {project.name}") == 0
    assert run_cmd(f"{CLI} file list -p {project.name} -m {mission.name}") == 0
    assert run_cmd(f"{CLI} file list") == 0
    assert run_cmd(f"{CLI} file list -p {project.name}") == 0
    assert run_cmd(f'{CLI} file list -p "*" -m "*" "*"') == 0


@pytest.mark.slow
def test_list_missions(api, project, mission):
    assert api

    # Legacy commands
    assert run_cmd(f"{CLI} list missions -p {project.name} {mission.name}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.name} {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.name} {mission.id}") == 0
    assert run_cmd(f"{CLI} list missions {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions {mission.id}") == 0
    assert run_cmd(f"{CLI} list missions {mission.name}") == 0

    assert run_cmd(f"{CLI} list missions -p {project.name}") == 0
    assert run_cmd(f"{CLI} list missions -p {project.id}") == 0
    assert run_cmd(f"{CLI} list missions -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list missions") == 0
    assert run_cmd(f'{CLI} list missions -p "*" "*"') == 0

    # New commands
    assert run_cmd(f"{CLI} mission list -p {project.name} {mission.name}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.name} {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.name} {mission.id}") == 0
    assert run_cmd(f"{CLI} mission list {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list {mission.id}") == 0
    assert run_cmd(f"{CLI} mission list {mission.name}") == 0

    assert run_cmd(f"{CLI} mission list -p {project.name}") == 0
    assert run_cmd(f"{CLI} mission list -p {project.id}") == 0
    assert run_cmd(f"{CLI} mission list -p {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} mission list") == 0
    assert run_cmd(f'{CLI} mission list -p "*" "*"') == 0


@pytest.mark.slow
def test_list_projects(api, project):
    assert api
    # Legacy commands
    assert run_cmd(f"{CLI} list projects") == 0
    assert run_cmd(f"{CLI} list projects {project.name}") == 0
    assert run_cmd(f"{CLI} list projects {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} list projects {project.id}") == 0
    assert run_cmd(f'{CLI} list projects "*"') == 0

    # New commands
    assert run_cmd(f"{CLI} project list") == 0
    assert run_cmd(f"{CLI} project list {project.name}") == 0
    assert run_cmd(f"{CLI} project list {secrets.token_hex(8)}") == 0
    assert run_cmd(f"{CLI} project list {project.id}") == 0
    assert run_cmd(f'{CLI} project list "*"') == 0


@pytest.mark.slow
def test_trigger_cli_operations(empty_mission, action_template, api):
    """E2E Test to verify CLI trigger commands process flags and return correct exit codes."""
    assert api

    trigger_name = f"trig-cli-{secrets.token_hex(6)}"
    create_cmd = (
        f"{CLI} trigger create {trigger_name} "
        f"--template {action_template.uuid} "
        f"--mission {empty_mission.id} "
        f"--type FILE "
        f"--file-patterns '*.bag' "
        f"--file-events UPLOAD"
    )
    assert run_cmd(create_cmd) == 0

    list_cmd = f"{CLI} trigger list --mission {empty_mission.id}"
    assert run_cmd(list_cmd) == 0

    fail_cmd = (
        f"{CLI} trigger create {trigger_name}-fail "
        f"--template {action_template.uuid} "
        f"--mission {empty_mission.id} "
        f"--type FILE"
    )
    assert run_cmd(fail_cmd) != 0

    triggers = kleinkram.wrappers.list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers) == 1
    trigger_uuid = triggers[0].uuid

    info_cmd = f"{CLI} trigger info {trigger_uuid}"
    assert run_cmd(info_cmd) == 0

    update_cmd = f"{CLI} trigger update {trigger_uuid} --description 'updated via E2E CLI'"
    assert run_cmd(update_cmd) == 0

    delete_cmd = f"{CLI} trigger delete {trigger_uuid} --yes"
    assert run_cmd(delete_cmd) == 0


@pytest.mark.slow
def test_cancel_execution(api, project, empty_mission):
    assert api

    # Create an action template that sleeps for 120 seconds
    template_name = f"template-cancel-{secrets.token_hex(6)}"
    kleinkram.wrappers.create_template(
        name=template_name,
        description="Template for cancellation test",
        docker_image="ubuntu:latest",
        cpu_cores=1,
        cpu_memory_gb=1,
        gpu_memory_gb=-1,
        max_runtime_minutes=60,
        command="sleep 120",
    )

    # Submit/launch the action run using the CLI launch command.
    # Run it without follow mode so it runs asynchronously in the queue/worker.
    import subprocess
    from uuid import UUID

    from kleinkram.api.client import AuthenticatedClient

    launch_cmd = f"{CLI} execution launch {template_name} -m {empty_mission.id}"
    res = subprocess.run(launch_cmd, shell=True, capture_output=True, text=True)
    assert res.returncode == 0, f"Launch failed: {res.stderr}"

    # Extract the Execution ID (UUID) from the launch output.
    # Output structure: "Action submitted. Execution ID: <uuid>"
    match = re.search(r"Execution ID:\s*([a-f0-9\-]+)", res.stdout, re.IGNORECASE)
    assert match is not None, f"Could not find Execution ID in output: {res.stdout}"
    execution_uuid = match.group(1)

    # Cancel the action execution using the CLI cancel command.
    cancel_cmd = f"{CLI} execution cancel {execution_uuid}"
    res_cancel = subprocess.run(cancel_cmd, shell=True, capture_output=True, text=True)
    assert res_cancel.returncode == 0, f"Cancel failed: {res_cancel.stderr}"
    assert "cancellation requested" in res_cancel.stdout.lower()

    # Poll the action details via get_execution wrapper for up to 10 seconds.
    # Assert that its state becomes CANCELLED.
    start_time = time.time()
    cancelled = False
    client = AuthenticatedClient()
    while time.time() - start_time < 10:
        execution_obj = kleinkram.api.routes.get_execution(client, execution_id=UUID(execution_uuid))
        if execution_obj.state == "CANCELLED":
            cancelled = True
            break
        time.sleep(0.5)

    assert cancelled, f"Execution was not cancelled in 10s. Current state: {execution_obj.state}"


def _nested_tree(root: Path) -> list[str]:
    """\
    a recording tree with the bags at several depths, plus files the
    recursive upload must ignore; returns the names that must be uploaded
    """
    layout = {
        "top.bag": "10_KB.bag",
        "run1/run1_a.bag": "10_KB.bag",
        "run1/deep/run1_deep.bag": "50_KB.bag",
        "run2/run2_a.bag": "10_KB.bag",
    }
    for rel, source in layout.items():
        dest = root / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(DATA_PATH / source, dest)
    (root / "notes.txt").write_text("unsupported suffix")
    (root / "run2" / ".hidden.bag").write_bytes((DATA_PATH / "10_KB.bag").read_bytes())
    return sorted(Path(rel).name for rel in layout)


def _remote_file_names(project, mission_name: str) -> list[str]:
    files = kleinkram.wrappers.list_files(project_ids=[project.id], mission_names=[mission_name])
    return sorted(f.name for f in files)


@pytest.mark.slow
def test_upload_and_verify_recursive_directory(project, tmp_path, api):
    assert api
    expected = _nested_tree(tmp_path / "tree")

    mission_name = secrets.token_hex(8)
    assert run_cmd(f"{CLI} upload -p {project.name} -m {mission_name} --create -r {tmp_path / 'tree'}") == 0
    assert _remote_file_names(project, mission_name) == expected

    assert run_cmd(f"{CLI} verify -p {project.name} -m {mission_name} -r {tmp_path / 'tree'}") == 0


@pytest.mark.slow
@pytest.mark.parametrize("shell", ["sh", "bash", "zsh"])
def test_upload_quoted_recursive_glob(project, tmp_path, api, shell):
    """the CLI expands a quoted `**` pattern itself, whatever the shell"""
    assert api
    if shutil.which(shell) is None:
        pytest.skip(f"{shell} is not installed")
    tree = tmp_path / "tree"
    expected = _nested_tree(tree)

    mission_name = secrets.token_hex(8)
    command = f"cd {tree} && {CLI} upload -p {project.name} -m {mission_name} --create '**/*.bag'"
    res = subprocess.run([shell, "-c", command], capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    assert _remote_file_names(project, mission_name) == expected


@pytest.mark.slow
def test_upload_recursive_name_clash_creates_nothing(project, tmp_path, api):
    """clashing names are refused before the mission is created"""
    assert api
    for run in ("run1", "run2"):
        (tmp_path / run).mkdir()
        shutil.copy(DATA_PATH / "10_KB.bag", tmp_path / run / "data.bag")

    mission_name = secrets.token_hex(8)
    res = subprocess.run(
        [CLI, "upload", "-p", project.name, "-m", mission_name, "--create", "-r", str(tmp_path)],
        capture_output=True,
        text=True,
    )
    assert res.returncode != 0
    assert "same name" in res.stderr + res.stdout
    assert kleinkram.wrappers.list_missions(project_ids=[project.id], mission_names=[mission_name]) == []


@pytest.mark.slow
def test_upload_dry_run_changes_nothing(project, tmp_path, api):
    assert api
    tree = tmp_path / "tree"
    expected = _nested_tree(tree)

    mission_name = secrets.token_hex(8)
    base = [CLI, "--no-verbose", "upload", "-p", project.name, "-m", mission_name]

    # the mission does not exist yet: nothing is created
    res = subprocess.run([*base, "--create", "--dry-run", "-r", str(tree)], capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    assert "would be created" in res.stderr
    planned = [line.split("\t") for line in res.stdout.splitlines()]
    assert sorted(name for _, _, name in planned) == expected
    assert {action for action, _, _ in planned} == {"upload"}
    assert kleinkram.wrappers.list_missions(project_ids=[project.id], mission_names=[mission_name]) == []

    # upload for real, then change one file locally and add one
    assert run_cmd(f"{CLI} upload -p {project.name} -m {mission_name} --create -r {tree}") == 0
    with open(tree / "top.bag", "ab") as f:
        f.write(b"changed")
    shutil.copy(DATA_PATH / "10_KB.bag", tree / "run2" / "run2_b.bag")

    res = subprocess.run([*base, "--dry-run", "-r", str(tree)], capture_output=True, text=True)
    assert res.returncode == 0, res.stderr
    actions = {name: action for action, _, name in (line.split("\t") for line in res.stdout.splitlines())}
    assert actions == {
        "top.bag": "skip-different",
        "run1_a.bag": "skip-same",
        "run1_deep.bag": "skip-same",
        "run2_a.bag": "skip-same",
        "run2_b.bag": "upload",
    }
    assert "different file with the same name" in res.stderr
    assert _remote_file_names(project, mission_name) == expected


@pytest.mark.slow
def test_upload_changed_file_with_taken_name_fails(project, tmp_path, api):
    assert api
    tree = tmp_path / "tree"
    _nested_tree(tree)
    mission_name = secrets.token_hex(8)
    assert run_cmd(f"{CLI} upload -p {project.name} -m {mission_name} --create -r {tree}") == 0

    # uploading the same files again is fine
    res = subprocess.run(
        [CLI, "upload", "-p", project.name, "-m", mission_name, "-r", str(tree)], capture_output=True, text=True
    )
    assert res.returncode == 0, res.stderr
    assert "NOT uploaded" not in res.stderr

    with open(tree / "top.bag", "ab") as f:
        f.write(b"changed")
    res = subprocess.run(
        [CLI, "upload", "-p", project.name, "-m", mission_name, "-r", str(tree)], capture_output=True, text=True
    )
    assert res.returncode == 1
    assert "1 file(s) were NOT uploaded" in res.stderr
    assert str(tree / "top.bag") in res.stderr


@pytest.mark.slow
def test_file_name_rules_match_the_server(project, tmp_path, api):
    """\
    the CLI refuses what the server would refuse, before anything is created,
    and every name --fix-filenames produces is accepted by the server
    """
    assert api
    local = tmp_path / "local"
    local.mkdir()
    names = ["a.bag", "REC.MCAP", "-dash.bag", "log(1).bag", "run.2024-05-14.bag"]
    for name in names:
        shutil.copy(DATA_PATH / "10_KB.bag", local / name)

    mission_name = secrets.token_hex(8)
    scope = ["-p", project.name, "-m", mission_name, "--create"]
    res = subprocess.run([CLI, "upload", *scope, str(local / "a.bag")], capture_output=True, text=True)
    assert res.returncode != 0
    assert "at least 3 characters" in res.stderr + res.stdout
    assert kleinkram.wrappers.list_missions(project_ids=[project.id], mission_names=[mission_name]) == []

    res = subprocess.run(
        [CLI, "upload", *scope, "--fix-filenames", "--", *(str(local / name) for name in names)],
        capture_output=True,
        text=True,
    )
    assert res.returncode == 0, res.stderr
    assert _remote_file_names(project, mission_name) == sorted(
        ["a_1fef.bag", "REC.mcap", "_dash.bag", "log_1_.bag", "run.2024-05-14.bag"]
    )


@pytest.mark.slow
def test_exit_codes_for_verify_and_download(project, tmp_path, api):
    """exit 0 only if every requested file was handled, in both output modes (the server rejects one-letter names)"""
    assert api
    local = tmp_path / "local"
    local.mkdir()
    shutil.copy(DATA_PATH / "10_KB.bag", local / "rec_a.bag")
    shutil.copy(DATA_PATH / "50_KB.bag", local / "rec_b.bag")
    mission_name = secrets.token_hex(8)
    scope = ["-p", project.name, "-m", mission_name]
    assert run_cmd(f"{CLI} upload -p {project.name} -m {mission_name} --create {local / 'rec_a.bag'}") == 0

    for mode in ("--verbose", "--no-verbose"):
        # b.bag was never uploaded
        res = subprocess.run(
            [CLI, mode, "verify", *scope, str(local / "rec_a.bag"), str(local / "rec_b.bag")], capture_output=True, text=True
        )
        assert res.returncode == 1, res.stderr
        assert "1 of 2 file(s) could not be verified." in res.stderr
        res = subprocess.run([CLI, mode, "verify", *scope, str(local / "rec_a.bag")], capture_output=True, text=True)
        assert res.returncode == 0, res.stderr

    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "rec_a.bag").write_bytes(b"a different local file")
    for mode in ("--verbose", "--no-verbose"):
        res = subprocess.run([CLI, mode, "download", *scope, "--dest", str(dest)], capture_output=True, text=True)
        assert res.returncode == 1, res.stderr
        assert "exists with file size mismatch" in res.stderr  # named in both modes
    res = subprocess.run(
        [CLI, "--no-verbose", "download", *scope, "--dest", str(dest), "--overwrite"], capture_output=True, text=True
    )
    assert res.returncode == 0, res.stderr
    assert (dest / "rec_a.bag").read_bytes() == (local / "rec_a.bag").read_bytes()
