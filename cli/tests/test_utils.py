from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import pytest

from kleinkram.errors import FileNameNotSupported
from kleinkram.errors import FileTypeNotSupported
from kleinkram.naming import get_file_name_validation_error
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import check_filename_is_sanatized
from kleinkram.utils import get_filename
from kleinkram.utils import get_filename_map
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import parse_path_like
from kleinkram.utils import parse_uuid_like
from kleinkram.utils import singleton_list
from kleinkram.utils import split_args
from kleinkram.utils import upper_camel_case_to_words


def test_split_args():
    uuid = uuid4()
    assert split_args([str(uuid)]) == ([uuid], [])
    assert split_args(["name"]) == ([], ["name"])
    assert split_args([str(uuid), "name"]) == ([uuid], ["name"])
    assert split_args(["name", str(uuid)]) == ([uuid], ["name"])
    assert split_args(["name", "name"]) == ([], ["name", "name"])
    assert split_args([str(uuid), str(uuid)]) == ([uuid, uuid], [])
    assert split_args([]) == ([], [])
    assert split_args(["*", str(uuid)]) == ([uuid], ["*"])


def test_check_file_paths():
    with TemporaryDirectory() as temp_dir:
        exits_txt = Path(temp_dir) / "exists.txt"
        exists_bag = Path(temp_dir) / "exists.bag"
        exits_mcap = Path(temp_dir) / "exists.mcap"
        not_exists = Path(temp_dir) / "not_exists.txt"
        is_dir = Path(temp_dir) / "is_dir"

        exits_txt.touch()
        exists_bag.touch()
        exits_mcap.touch()
        is_dir.mkdir()

        with pytest.raises(FileTypeNotSupported):
            check_file_paths([exits_txt])

        with pytest.raises(FileNotFoundError):
            check_file_paths([not_exists])

        with pytest.raises(FileNotFoundError):
            check_file_paths([is_dir])

        assert check_file_paths([exists_bag, exits_mcap]) is None


def test_check_file_paths_without_filename_check():
    with TemporaryDirectory() as temp_dir:
        bad_name_bag = Path(temp_dir) / "bad name!.bag"
        bad_name_txt = Path(temp_dir) / "bad name!.txt"

        bad_name_bag.touch()
        bad_name_txt.touch()

        with pytest.raises(FileNameNotSupported):
            check_file_paths([bad_name_bag])

        assert check_file_paths([bad_name_bag], check_filename=False) is None

        # the suffix is still checked
        with pytest.raises(FileTypeNotSupported):
            check_file_paths([bad_name_txt], check_filename=False)


def test_check_filename_is_sanatized():
    """the part before the extension, by the shared rule (see `kleinkram.naming`)"""
    assert check_filename_is_sanatized("t_-est")
    assert check_filename_is_sanatized("run.2024")
    assert not check_filename_is_sanatized("test%")
    assert not check_filename_is_sanatized("a" * 100)
    assert not check_filename_is_sanatized("ab")
    assert not check_filename_is_sanatized("-dash")


def test_is_valid_uuid4():
    valid = "e896313b-2ab0-466b-b458-8911575fdee9"
    invalid = "hello world"

    assert is_valid_uuid4(valid)
    assert not is_valid_uuid4(invalid)


@pytest.mark.parametrize(
    "old, new",
    [
        pytest.param(Path("test.bar"), "test.bar", id="short name"),
        pytest.param(Path("symbols_-123.txt"), "symbols_-123.txt", id="symbols"),
        pytest.param(
            Path("invalid sybmols $%^&.txt"),
            "invalid_sybmols_____.txt",
            id="invalid symbols",
        ),
        pytest.param(Path(f'{"a" * 100}.txt'), f'{"a" * 40}38bf3e475f.txt', id="too long"),
        pytest.param(Path(f'{"a" * 50}.txt'), f'{"a" * 50}.txt', id="max length"),
        pytest.param(Path("in/a/folder.txt"), "folder.txt", id="in folder"),
        pytest.param(Path("run.2024-05-14.bag"), "run.2024-05-14.bag", id="dots are kept"),
        pytest.param(Path("log(1).bag"), "log_1_.bag", id="brackets"),
        pytest.param(Path("REC.MCAP"), "REC.mcap", id="extension is lowercased"),
        pytest.param(Path("-dash.bag"), "_dash.bag", id="leading dash"),
        pytest.param(Path(".hidden.bag"), "_hidden.bag", id="leading dot"),
        pytest.param(Path("a.bag"), "a_1fef.bag", id="too short is padded with a hash"),
        pytest.param(
            Path("3f2ad2c6-6e2a-4c6b-9a1d-9f6f0f3b7f21.bag"),
            "3f2ad2c6-6e2a-4c6b-9a1d-9f6f0f3b7f21_d81c.bag",
            id="uuid",
        ),
    ],
)
def test_get_filename(old, new):
    assert get_filename(old) == new


@pytest.mark.parametrize(
    "name",
    ["a.bag", "ab.MCAP", "-x.bag", ".x.bag", "über müller (1).mcap", "日本.bag", "a" * 80 + ".csv", "...bag", "x y.YAML"],
)
def test_get_filename_always_gives_a_valid_name(name):
    """`--fix-filenames` promises an upload instead of an error for any supported file"""
    fixed = get_filename(Path(name))
    assert get_file_name_validation_error(fixed) is None, fixed
    assert get_filename(Path(name)) == fixed  # deterministic


def test_get_filename_map():
    non_unique = [Path("a.txt"), Path("a.txt")]

    with pytest.raises(ValueError):
        get_filename_map(non_unique)

    unique = [Path("a.txt"), Path("b.txt")]
    assert get_filename_map(unique) == {get_filename(Path(p)): Path(p) for p in unique}


@pytest.mark.parametrize(
    "paths",
    [
        # same basename in different directories
        [Path("run1/data.mcap"), Path("run2/data.mcap")],
        # different names that sanitize to the same internal name
        [Path("a b.mcap"), Path("a_b.mcap")],
    ],
)
def test_get_filename_map_raises_on_name_clash(paths):
    with pytest.raises(ValueError) as exc_info:
        get_filename_map(paths)

    message = str(exc_info.value)
    for path in paths:
        assert str(path) in message


def test_b64_md5():
    with TemporaryDirectory() as temp_dir:
        file = Path(temp_dir) / "file.txt"
        file.write_text("hello world")

        assert b64_md5(file) == "XrY7u+Ae7tCTyyK7j1rNww=="


def test_singleton_list() -> None:
    assert [] == singleton_list(None)
    assert [1] == singleton_list(1)
    assert [[1]] == singleton_list([1])
    assert [True] == singleton_list(True)

    ob = object()
    assert [ob] == singleton_list(ob)


def test_parse_uuid_like() -> None:
    _id = uuid4()
    assert parse_uuid_like(str(_id)) == _id
    assert parse_uuid_like(_id) == _id

    with pytest.raises(ValueError):
        parse_uuid_like("invalid")


def test_parse_path_like() -> None:
    assert parse_path_like("test") == Path("test")
    assert parse_path_like(Path("test")) == Path("test")


def test_upper_camel_case_to_words() -> None:
    assert upper_camel_case_to_words("HelloWorld") == ["Hello", "World"]
    assert upper_camel_case_to_words("HelloWorldAgain") == ["Hello", "World", "Again"]
    assert upper_camel_case_to_words("Hello") == ["Hello"]
    assert upper_camel_case_to_words("hello") == ["hello"]
    assert upper_camel_case_to_words("") == []
    assert upper_camel_case_to_words("not_camel_case") == ["not_camel_case"]
    assert upper_camel_case_to_words("*#?-_") == ["*#?-_"]
    assert upper_camel_case_to_words("helloWorld") == ["hello", "World"]
