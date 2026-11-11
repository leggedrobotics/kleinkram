"""\
`klein upload` / `klein verify` must pick up the same files in every shell:
directories with `--recursive` and quoted glob patterns are expanded by the
CLI itself, see `kleinkram/cli/_file_expansion.py`
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import List
from unittest.mock import MagicMock

import pytest
from typer.testing import CliRunner

import kleinkram.api.file_transfer
import kleinkram.cli.app
import kleinkram.core
from kleinkram.api.file_transfer import UploadResult
from kleinkram.cli._file_expansion import expand_file_args
from kleinkram.cli.app import app
from kleinkram.utils import SUPPORT_FILE_TYPES

# every supported file below `tree`, in sorted order
ALL_SUPPORTED = [
    "run1/deep/x.mcap",
    "run1/meta.yaml",
    "run1/one.mcap",
    "run2/two.bag",
    "top.mcap",
]
ALL_MCAP = ["run1/deep/x.mcap", "run1/one.mcap", "top.mcap"]


@pytest.fixture
def tree(tmp_path: Path) -> Path:
    """\
    tree/
      top.mcap
      notes.txt              unsupported suffix
      run1/one.mcap
      run1/meta.yaml
      run1/deep/x.mcap
      run2/two.bag
      run2/.hidden.mcap      hidden file
      .git/obj.mcap          inside a hidden directory
      empty/
    """
    root = tmp_path / "tree"
    for rel in [*ALL_SUPPORTED, "notes.txt", "run2/.hidden.mcap", ".git/obj.mcap"]:
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(rel.encode())
    (root / "empty").mkdir()
    return root


@pytest.fixture
def chdir_tree(tree: Path, monkeypatch) -> Path:
    monkeypatch.chdir(tree)
    return tree


def rel(paths: List[Path], root: Path) -> List[str]:
    return [p.resolve().relative_to(root.resolve()).as_posix() for p in paths]


# --------------------------------------------------------------------------
# expand_file_args
# --------------------------------------------------------------------------


def test_plain_files_are_passed_through(tree):
    args = [str(tree / "top.mcap"), str(tree / "run2/two.bag")]
    assert expand_file_args(args, recursive=False, suffixes=SUPPORT_FILE_TYPES) == [Path(a) for a in args]


def test_missing_file_is_passed_through_for_the_validator(tree):
    missing = str(tree / "missing.mcap")
    assert expand_file_args([missing], recursive=False, suffixes=SUPPORT_FILE_TYPES) == [Path(missing)]


def test_directory_without_recursive_is_passed_through(tree):
    assert expand_file_args([str(tree)], recursive=False, suffixes=SUPPORT_FILE_TYPES) == [tree]


def test_recursive_directory_collects_supported_files(tree):
    files = expand_file_args([str(tree)], recursive=True, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, tree) == ALL_SUPPORTED


def test_recursive_only_collects_given_suffixes(tree):
    files = expand_file_args([str(tree)], recursive=True, suffixes=[".mcap"])
    assert rel(files, tree) == ALL_MCAP


def test_recursive_suffix_match_is_case_sensitive_like_the_upload(tree):
    """`check_file_paths` and the server reject `.MCAP`; selecting it would stop the whole batch"""
    (tree / "UPPER.MCAP").write_bytes(b"x")
    files = expand_file_args([str(tree)], recursive=True, suffixes=[".mcap"])
    assert "UPPER.MCAP" not in rel(files, tree)
    assert rel(files, tree) == ALL_MCAP


@pytest.mark.skipif(not hasattr(os, "geteuid") or os.geteuid() == 0, reason="root can read everything")
def test_recursive_unreadable_directory_raises(tree):
    locked = tree / "run1" / "locked"
    locked.mkdir()
    (locked / "secret.mcap").write_bytes(b"x")
    locked.chmod(0)
    try:
        with pytest.raises(PermissionError):
            expand_file_args([str(tree)], recursive=True, suffixes=SUPPORT_FILE_TYPES)
    finally:
        locked.chmod(0o755)


def test_recursive_does_not_enter_hidden_directories(tree, monkeypatch):
    (tree / ".venv" / "lib").mkdir(parents=True)
    visited = []
    real_scandir = os.scandir

    def recording_scandir(path):
        visited.append(Path(path))
        return real_scandir(path)

    monkeypatch.setattr(os, "scandir", recording_scandir)
    expand_file_args([str(tree)], recursive=True, suffixes=SUPPORT_FILE_TYPES)

    assert visited, "the walk should use os.scandir"
    assert not [p for p in visited if any(part.startswith(".") for part in p.relative_to(tree).parts)]


def test_recursive_relative_directory(chdir_tree):
    files = expand_file_args(["run1"], recursive=True, suffixes=SUPPORT_FILE_TYPES)
    assert [p.as_posix() for p in files] == ["run1/deep/x.mcap", "run1/meta.yaml", "run1/one.mcap"]


def test_recursive_empty_directory_warns(tree, capsys):
    assert expand_file_args([str(tree / "empty")], recursive=True, suffixes=SUPPORT_FILE_TYPES) == []
    assert "No supported files found" in capsys.readouterr().err


def test_recursive_glob_matches_every_level(chdir_tree):
    files = expand_file_args(["**/*.mcap"], recursive=False, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, chdir_tree) == ALL_MCAP


def test_glob_with_absolute_path(tree):
    files = expand_file_args([str(tree / "**" / "*.mcap")], recursive=False, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, tree) == ALL_MCAP


def test_single_star_glob_stays_on_one_level(chdir_tree):
    files = expand_file_args(["*/*.mcap"], recursive=False, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, chdir_tree) == ["run1/one.mcap"]


def test_glob_matching_directories_is_walked_with_recursive(chdir_tree):
    files = expand_file_args(["run*"], recursive=True, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, chdir_tree) == ["run1/deep/x.mcap", "run1/meta.yaml", "run1/one.mcap", "run2/two.bag"]


def test_glob_matching_directories_without_recursive_passes_them_on(chdir_tree):
    files = expand_file_args(["run*"], recursive=False, suffixes=SUPPORT_FILE_TYPES)
    assert files == [Path("run1"), Path("run2")]


def test_glob_without_matches_is_passed_through(chdir_tree):
    assert expand_file_args(["**/*.svo2"], recursive=False, suffixes=SUPPORT_FILE_TYPES) == [Path("**/*.svo2")]


def test_existing_file_with_glob_chars_is_not_expanded(chdir_tree):
    (chdir_tree / "odd[1].mcap").write_bytes(b"x")
    (chdir_tree / "odd1.mcap").write_bytes(b"x")
    assert expand_file_args(["odd[1].mcap"], recursive=False, suffixes=SUPPORT_FILE_TYPES) == [Path("odd[1].mcap")]


def test_duplicates_are_removed_in_argument_order(chdir_tree):
    files = expand_file_args(
        ["top.mcap", "**/*.mcap", ".", "./top.mcap"],
        recursive=True,
        suffixes=SUPPORT_FILE_TYPES,
    )
    assert rel(files, chdir_tree) == ["top.mcap", "run1/deep/x.mcap", "run1/one.mcap", "run1/meta.yaml", "run2/two.bag"]


# --------------------------------------------------------------------------
# klein upload / klein verify
# --------------------------------------------------------------------------


@pytest.fixture
def runner() -> CliRunner:
    try:
        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
    except TypeError:  # click >= 8.2 always keeps stderr separate
        return CliRunner()


@pytest.fixture
def offline(monkeypatch, tmp_path):
    """skip the network and config side effects of the root callback"""
    monkeypatch.setattr(kleinkram.cli.app, "check_version_compatibility", lambda: None)
    monkeypatch.setattr(kleinkram.cli.app, "check_config_compatibility", lambda: True)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_DIR", tmp_path)
    monkeypatch.setattr(kleinkram.cli.app, "LOG_FILE", tmp_path / "log")


@pytest.fixture
def fake_upload(monkeypatch, offline) -> MagicMock:
    upload = MagicMock(return_value=UploadResult(uploaded=1))
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.upload", upload)
    return upload


@pytest.fixture
def fake_verify(monkeypatch, offline) -> MagicMock:
    verify = MagicMock(return_value={})
    monkeypatch.setattr("kleinkram.cli._verify.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.core.verify", verify)
    monkeypatch.setattr("kleinkram.cli._verify.print_file_verification_status", MagicMock())
    return verify


def uploaded(mock: MagicMock, root: Path) -> List[str]:
    (call,) = mock.call_args_list
    return rel(list(call.kwargs["file_paths"]), root)


@pytest.mark.parametrize("flag", ["--recursive", "-r"])
def test_upload_recursive_directory(runner, fake_upload, chdir_tree, flag):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", flag, "."])
    assert result.exit_code == 0, result.output
    assert uploaded(fake_upload, chdir_tree) == ALL_SUPPORTED


def test_upload_quoted_glob(runner, fake_upload, chdir_tree):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "**/*.mcap"])
    assert result.exit_code == 0, result.output
    assert uploaded(fake_upload, chdir_tree) == ALL_MCAP


def test_upload_directory_without_recursive_suggests_it(runner, fake_upload, chdir_tree):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "run1"])
    assert result.exit_code != 0
    assert isinstance(result.exception, IsADirectoryError)
    assert "--recursive" in str(result.exception)
    fake_upload.assert_not_called()


def test_upload_glob_without_matches_fails(runner, fake_upload, chdir_tree):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "**/*.svo2"])
    assert result.exit_code != 0
    assert isinstance(result.exception, FileNotFoundError)
    assert "**/*.svo2" in str(result.exception)
    fake_upload.assert_not_called()


def test_upload_recursive_empty_directory_fails(runner, fake_upload, chdir_tree):
    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "-r", "empty"])
    assert result.exit_code != 0
    assert "No supported files found" in result.stderr
    fake_upload.assert_not_called()


def test_upload_recursive_name_clash_is_refused(runner, offline, monkeypatch, tmp_path):
    """the recursive walk must not silently drop files that share a name"""
    for run in ("run1", "run2"):
        (tmp_path / run).mkdir()
        (tmp_path / run / "data.mcap").write_bytes(run.encode())
    monkeypatch.chdir(tmp_path)

    get_mission = MagicMock()
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)
    monkeypatch.setattr("kleinkram.api.routes.get_mission", get_mission)

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "-r", "."])
    assert result.exit_code != 0
    assert isinstance(result.exception, ValueError)
    assert "same name" in str(result.exception)
    get_mission.assert_not_called()


def test_verify_recursive_and_glob(runner, fake_verify, chdir_tree):
    result = runner.invoke(app, ["--no-verbose", "verify", "-p", "p", "-m", "m", "-r", "run2", "**/one.mcap"])
    assert result.exit_code == 0, result.output
    (call,) = fake_verify.call_args_list
    assert rel(list(call.kwargs["file_paths"]), chdir_tree) == ["run2/two.bag", "run1/one.mcap"]


# --------------------------------------------------------------------------
# real shells: whatever the shell does with the arguments, the CLI ends up
# with the same files
# --------------------------------------------------------------------------

SHELLS = ["sh", "bash", "zsh", "fish"]
PRINT_ARGV = f'"{sys.executable}" -c "import sys; print(chr(0).join(sys.argv[1:]))"'


def argv_from_shell(shell: str, cwd: Path, args: str) -> List[str]:
    """the argument list `shell` hands to a program for the command line `args`"""
    if shutil.which(shell) is None:
        pytest.skip(f"{shell} is not installed")
    # a clean environment, no rc files: the default behaviour of the shell
    env = {"PATH": os.environ.get("PATH", ""), "HOME": str(cwd)}
    out = subprocess.run([shell, "-c", f"{PRINT_ARGV} {args}"], cwd=cwd, env=env, capture_output=True, text=True, check=True)
    return out.stdout.rstrip("\n").split("\0")


@pytest.mark.parametrize("shell", SHELLS)
def test_quoted_glob_is_expanded_the_same_in_every_shell(shell, chdir_tree):
    argv = argv_from_shell(shell, chdir_tree, "'**/*.mcap'")
    assert argv == ["**/*.mcap"]  # the shell left it alone

    files = expand_file_args(argv, recursive=False, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, chdir_tree) == ALL_MCAP


@pytest.mark.parametrize("shell", SHELLS)
def test_recursive_directory_is_expanded_the_same_in_every_shell(shell, tree, monkeypatch):
    monkeypatch.chdir(tree.parent)
    argv = argv_from_shell(shell, tree.parent, "tree")
    files = expand_file_args(argv, recursive=True, suffixes=SUPPORT_FILE_TYPES)
    assert rel(files, tree) == ALL_SUPPORTED


def test_unquoted_globstar_in_bash_misses_files(tree):
    """\
    documents why quoting matters: without `shopt -s globstar`, bash treats
    `**` like `*`, expands the pattern itself and the CLI never sees it
    """
    argv = argv_from_shell("bash", tree, "**/*.mcap")
    assert argv == ["run1/one.mcap"]


def test_upload_recursive_with_uppercase_suffix_passes_the_real_core_check(runner, offline, monkeypatch, chdir_tree):
    """only the server and the transfer are mocked, `kleinkram.core.upload` runs for real"""
    (chdir_tree / "UPPER.MCAP").write_bytes(b"x")
    routes = MagicMock()
    monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)
    monkeypatch.setattr("kleinkram.cli._upload.AuthenticatedClient", MagicMock)
    upload_files = MagicMock(return_value=UploadResult(uploaded=len(ALL_SUPPORTED)))
    monkeypatch.setattr(kleinkram.api.file_transfer, "upload_files", upload_files)

    result = runner.invoke(app, ["--no-verbose", "upload", "-p", "p", "-m", "m", "-r", "."])

    assert result.exit_code == 0, result.output
    (call,) = upload_files.call_args_list
    filename_map = call.args[1]
    assert sorted(filename_map) == sorted(Path(p).name for p in ALL_SUPPORTED)
