from __future__ import annotations

import base64
import glob
import hashlib
import os
import string
from hashlib import md5
from pathlib import Path
from typing import Any
from typing import Dict
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Sequence
from typing import Tuple
from typing import Union
from uuid import UUID

import yaml
from kleinkram._version import __version__
from kleinkram.errors import FileTypeNotSupported
from kleinkram.errors import InvalidFileSpec
from kleinkram.errors import InvalidMissionSpec
from kleinkram.models import FilesById
from kleinkram.models import FilesByMission
from kleinkram.models import MissionById
from kleinkram.models import MissionByName
from rich.console import Console


INTERNAL_ALLOWED_CHARS = string.ascii_letters + string.digits + "_" + "-"


def check_file_paths(files: Sequence[Path]) -> None:
    for file in files:
        if file.is_dir():
            raise FileNotFoundError(f"{file} is a directory and not a file")
        if not file.exists():
            raise FileNotFoundError(f"{file} does not exist")
        if file.suffix not in (".bag", ".mcap"):
            raise FileTypeNotSupported(
                f"only `.bag` or `.mcap` files are supported: {file}"
            )


def raw_rich(*objects: Any, **kwargs: Any) -> str:
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


def get_valid_mission_spec(
    mission: Union[str, UUID],
    project: Optional[Union[str, UUID]] = None,
) -> Union[MissionById, MissionByName]:
    """\
    checks if:
    - atleast one is speicifed
    - if project is not specified then mission must be a valid uuid4
    """

    if isinstance(mission, UUID):
        return MissionById(id=mission)
    if isinstance(mission, str) and project is not None:
        return MissionByName(name=mission, project=project)
    raise InvalidMissionSpec("must specify mission id or project name / id")


def get_valid_file_spec(
    files: Sequence[Union[str, UUID]],
    mission: Optional[Union[str, UUID]] = None,
    project: Optional[Union[str, UUID]] = None,
) -> Union[FilesById, FilesByMission]:
    """\
    """
    if not any([project, mission, files]):
        raise InvalidFileSpec("must specify `project`, `mission` or `files`")

    # if only files are specified they must be valid uuid4
    if project is None and mission is None:
        if all(map(lambda file: isinstance(file, UUID), files)):
            return FilesById(ids=files)  # type: ignore
        raise InvalidFileSpec("if no mission is specified files must be valid uuid4")

    if mission is None:
        raise InvalidMissionSpec("mission must be specified")
    mission_spec = get_valid_mission_spec(mission, project)
    return FilesByMission(mission=mission_spec, files=list(files))


def to_name_or_uuid(s: str) -> Union[UUID, str]:
    if is_valid_uuid4(s):
        return UUID(s)
    return s


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
