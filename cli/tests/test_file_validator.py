from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from kleinkram.cli._file_validator import FileValidator
from kleinkram.errors import FileNameNotSupported


def test_bad_filename_is_rejected():
    with TemporaryDirectory() as temp_dir:
        bad_name = Path(temp_dir) / "bad name!.bag"
        bad_name.touch()

        validator = FileValidator(skip=False, experimental_datatypes=False)

        with pytest.raises(FileNameNotSupported, match="--fix-filenames"):
            validator.filter_files([bad_name])


def test_bad_filename_is_accepted_with_fix_filenames():
    with TemporaryDirectory() as temp_dir:
        bad_name = Path(temp_dir) / "bad name!.bag"
        bad_name.touch()

        validator = FileValidator(skip=False, experimental_datatypes=False, fix_filenames=True)

        assert validator.filter_files([bad_name]) == [bad_name]
        assert validator.skipped_files == []


def test_fix_filenames_does_not_skip_other_checks():
    with TemporaryDirectory() as temp_dir:
        bad_type = Path(temp_dir) / "bad name!.txt"
        bad_type.touch()
        is_dir = Path(temp_dir) / "some dir"
        is_dir.mkdir()

        validator = FileValidator(skip=True, experimental_datatypes=False, fix_filenames=True)

        assert validator.filter_files([bad_type, is_dir]) == []
        assert len(validator.skipped_files) == 2


@pytest.mark.parametrize("name", ["-dash.bag", "bad name!.bag", "REC.MCAP", "0b4e4a5e-6c1e-4c5e-9f3e-1d2c3b4a5f6e.bag"])
def test_name_rule_is_not_checked_without_check_filename(name):
    """`klein verify` must reach files uploaded under an older naming rule"""
    with TemporaryDirectory() as temp_dir:
        path = Path(temp_dir) / name
        path.touch()

        validator = FileValidator(skip=False, experimental_datatypes=False, check_filename=False)

        assert validator.filter_files([path]) == [path]
