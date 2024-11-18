from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import pytest
from kleinkram.errors import FileTypeNotSupported
from kleinkram.errors import InvalidFileSpec
from kleinkram.errors import InvalidMissionSpec
from kleinkram.models import FilesById
from kleinkram.models import FilesByMission
from kleinkram.models import MissionById
from kleinkram.models import MissionByName
from kleinkram.utils import b64_md5
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename
from kleinkram.utils import get_filename_map
from kleinkram.utils import get_valid_file_spec
from kleinkram.utils import get_valid_mission_spec
from kleinkram.utils import is_valid_uuid4
from kleinkram.utils import to_name_or_uuid


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
        pytest.param(
            Path(f'{"a" * 100}.txt'), f'{"a" * 40}38bf3e475f.txt', id="too long"
        ),
        pytest.param(Path(f'{"a" * 50}.txt'), f'{"a" * 50}.txt', id="max length"),
        pytest.param(Path("in/a/folder.txt"), "folder.txt", id="in folder"),
    ],
)
def test_get_filename(old, new):
    assert get_filename(old) == new


def test_get_filename_map():
    non_unique = [Path("a.txt"), Path("a.txt")]

    with pytest.raises(ValueError):
        get_filename_map(non_unique)

    unique = [Path("a.txt"), Path("b.txt")]
    assert get_filename_map(unique) == {get_filename(Path(p)): Path(p) for p in unique}


def test_b64_md5():
    with TemporaryDirectory() as temp_dir:
        file = Path(temp_dir) / "file.txt"
        file.write_text("hello world")

        assert b64_md5(file) == "XrY7u+Ae7tCTyyK7j1rNww=="


def test_get_valid_mission_spec():
    # only mission name
    with pytest.raises(InvalidMissionSpec):
        get_valid_mission_spec("mission")

    # only mission id
    id_ = uuid4()
    assert get_valid_mission_spec(id_) == MissionById(id_)

    # mission name and project name
    assert get_valid_mission_spec("mission", "project") == MissionByName(
        "mission", "project"
    )

    # mission name and project id
    project_id = uuid4()
    assert get_valid_mission_spec("mission", project_id) == MissionByName(
        "mission", project_id
    )

    # mission id and project name
    assert get_valid_mission_spec(id_, "project") == MissionById(id_)


def test_get_valid_file_spec():
    # no information
    with pytest.raises(InvalidFileSpec):
        get_valid_file_spec([], None, None)

    # only file ids
    file_ids = [uuid4(), uuid4()]
    assert get_valid_file_spec(file_ids, None, None) == FilesById(file_ids)

    # only file names
    with pytest.raises(InvalidFileSpec):
        get_valid_file_spec(["foo"], None, None)

    # missing mission
    with pytest.raises(InvalidMissionSpec):
        get_valid_file_spec([], None, "project")

    # mission name and file names
    assert get_valid_file_spec([], "mission", "project") == FilesByMission(
        MissionByName("mission", "project"), []
    )

    assert get_valid_file_spec(
        file_ids + ["name"], "mission", "project"
    ) == FilesByMission(MissionByName("mission", "project"), file_ids + ["name"])


def test_to_name_or_uuid():
    id_ = uuid4()
    not_id = "not an id"

    assert to_name_or_uuid(str(id_)) == id_
    assert to_name_or_uuid(not_id) == not_id
