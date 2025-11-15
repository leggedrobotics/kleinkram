from __future__ import annotations

import base64
import hashlib
import math
import re
import string
import traceback
from hashlib import md5
from pathlib import Path
from typing import Any
from typing import Dict
from typing import List
from typing import Optional
from typing import Sequence
from typing import Tuple
from typing import TypeVar
from uuid import UUID

import yaml
from rich.console import Console

from kleinkram._version import __version__
from kleinkram.errors import FileNameNotSupported
from kleinkram.errors import FileTypeNotSupported
from kleinkram.models import File
from kleinkram.types import IdLike
from kleinkram.types import PathLike

INTERNAL_ALLOWED_CHARS = string.ascii_letters + string.digits + "_" + "-"
SUPPORT_FILE_TYPES = [".bag", ".mcap", ".db3", ".svo2", ".tum", ".yaml", ".yml"]
EXPERIMENTAL_FILE_TYPES = []


def file_paths_from_files(
    files: Sequence[File], *, dest: Path, allow_nested: bool = False
) -> Dict[Path, File]:
    """\
    determines the destinations for a sequence of `File` objects,
    possibly nested by project and mission
    """
    if len(set([file.mission_id for file in files])) > 1 and not allow_nested:
        raise ValueError("files from multiple missions were selected")
    elif not allow_nested:
        return {dest / file.name: file for file in files}
    else:
        return {
            dest / file.project_name / file.mission_name / file.name: file
            for file in files
        }


def upper_camel_case_to_words(s: str) -> List[str]:
    """split `s` given upper camel case to words"""
    return re.sub("([a-z])([A-Z])", r"\1 \2", s).split()


def split_args(args: Sequence[str]) -> Tuple[List[UUID], List[str]]:
    """\
    split a sequece of strings into a list of UUIDs and a list of names
    depending on whether the string is a valid UUID or not
    """
    uuids = []
    names = []
    for arg in args:
        if is_valid_uuid4(arg):
            uuids.append(UUID(arg, version=4))
        else:
            names.append(arg)
    return uuids, names


def check_file_paths(files: Sequence[Path]) -> None:
    """\
    checks that files exist, are files and have a supported file suffix

    NOTE: kleinkram treats filesuffixes as filetypes and limits
    the supported suffixes
    """
    for file in files:
        check_file_path(file)


def check_file_path(file: Path) -> None:
    if file.is_dir():
        raise FileNotFoundError(f"{file} is a directory and not a file")
    if not file.exists():
        raise FileNotFoundError(f"{file} does not exist")
    if file.suffix not in SUPPORT_FILE_TYPES:
        raise FileTypeNotSupported(
            f"only {', '.join(SUPPORT_FILE_TYPES)} files are supported: {file}"
        )
    if not check_filename_is_sanatized(file.stem):
        raise FileNameNotSupported(
            f"only `{''.join(INTERNAL_ALLOWED_CHARS)}` are "
            f"allowed in filenames and at most 50chars: {file}"
        )


def format_error(msg: str, exc: Exception, *, verbose: bool = False) -> str:
    if not verbose:
        ret = f"{msg}: {type(exc).__name__}"
    else:
        ret = f"{msg}: {exc}"
    return styled_string(ret, style="red")


def format_traceback(exc: Exception) -> str:
    return "".join(
        traceback.format_exception(type(exc), value=exc, tb=exc.__traceback__)
    )


def styled_string(*objects: Any, **kwargs: Any) -> str:
    """\
    accepts any object that Console.print can print
    returns the raw string output
    """
    console = Console()
    with console.capture() as capture:
        console.print(*objects, **kwargs, end="")
    return capture.get()


def is_valid_uuid4(uuid: str) -> bool:
    try:
        UUID(uuid, version=4)
        return True
    except ValueError:
        return False


def check_filename_is_sanatized(filename: str) -> bool:
    if len(filename) > 50:
        return False
    if not all(char in INTERNAL_ALLOWED_CHARS for char in filename):
        return False
    return True


def get_filename(path: Path) -> str:
    """\
    takes a path and returns a sanitized filename

    the format for this internal filename is:
    - replace all disallowed characters with "_"
    - trim to 40 chars + 10 hashed chars
        - the 10 hashed chars are deterministic given the original filename
    """

    stem = "".join(
        char if char in INTERNAL_ALLOWED_CHARS else "_" for char in path.stem
    )

    if len(stem) > 50:
        hash = md5(path.name.encode()).hexdigest()
        stem = f"{stem[:40]}{hash[:10]}"

    return f"{stem}{path.suffix}"


def get_filename_map(file_paths: Sequence[Path]) -> Dict[str, Path]:
    """\
    takes a list of unique filepaths and returns a mapping
    from the original filename to a sanitized internal filename
    see `get_filename` for the internal filename format
    """

    if len(file_paths) != len(set(file_paths)):
        raise ValueError("files paths must be unique")

    internal_file_map = {}
    for file in file_paths:
        if file.is_dir():
            raise ValueError(f"got dir {file} expected file")

        internal_file_map[get_filename(file)] = file

    if len(internal_file_map) != len(set(internal_file_map.values())):
        raise RuntimeError("hash collision")

    return internal_file_map


def b64_md5(file: Path) -> str:
    hash_md5 = hashlib.md5()
    with open(file, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    binary_digest = hash_md5.digest()
    return base64.b64encode(binary_digest).decode("utf-8")


def load_metadata(path: Path) -> Dict[str, str]:
    if not path.exists():
        raise FileNotFoundError(f"metadata file not found: {path}")
    try:
        with path.open() as f:
            return {str(k): str(v) for k, v in yaml.safe_load(f).items()}
    except Exception as e:
        raise ValueError(f"could not parse metadata file: {e}")


def get_supported_api_version() -> Tuple[int, int, int]:
    vers = __version__.split(".")
    return tuple(map(int, vers[:3]))  # type: ignore


T = TypeVar("T")


def singleton_list(x: Optional[T]) -> List[T]:
    return [] if x is None else [x]


def parse_uuid_like(s: IdLike) -> UUID:
    return UUID(str(s))


def parse_path_like(s: PathLike) -> Path:
    return Path(s)


def format_bytes(size_bytes: int | float, speed: bool = False) -> str:
    """Formats a size in bytes into a human-readable string with appropriate units."""
    if size_bytes == 0:
        return "0 B/s" if speed else "0 B"

    units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    power = math.floor(math.log(size_bytes, 1000))
    unit_index = min(power, len(units) - 1)

    value = size_bytes / (1000**unit_index)

    unit_suffix = "/s" if speed else ""
    return f"{value:.2f} {units[unit_index]}{unit_suffix}"
