from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest
from kleinkram.errors import FileTypeNotSupported
from kleinkram.utils import check_file_paths
from kleinkram.utils import get_filename
from kleinkram.utils import is_valid_uuid4


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
