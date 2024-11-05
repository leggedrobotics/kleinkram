from __future__ import annotations

import glob
import os
import secrets
import string
from pathlib import Path
from typing import Dict, Optional, Union, NamedTuple
from typing import Generator
from typing import List
from uuid import UUID

import hashlib
import base64


INTERNAL_ALLOWED_CHARS = string.ascii_letters + string.digits + "_" + "-"


def patterns_matched(patterns: List[str]) -> Generator[Path, None, None]:
    for pattern in patterns:
        yield from pattern_matched(pattern)


def pattern_matched(pattern: str) -> Generator[Path, None, None]:
    """\
    yields path to files matching a glob pattern
    expanding user and environment variables
    """
    expanded = os.path.expandvars(os.path.expanduser(pattern))
    yield from map(Path, glob.iglob(expanded, recursive=True))


def get_version() -> str:
    # TODO
    return "0.1.0"


def is_valid_uuid4(uuid: str) -> bool:
    try:
        UUID(uuid, version=4)
        return True
    except ValueError:
        return False


def is_valid_name(name: str) -> bool:
    # TODO: this is a placeholder
    return not is_valid_uuid4(name)


def get_internal_file_map(files: List[Path]) -> Dict[Path, str]:
    """\
    takes a list of unique filepaths and returns a mapping
    from the original filename to a sanitized internal filename

    the format for this internal filename is:
    - replace all disallowed characters with "_"
    - trim to 40 chars + 10 random chars

    allowed chars are:
    - ascii letters (upper and lower case)
    - digits
    - "_" and "-"
    """
    internal_file_map = {}

    for file in files:
        if file.is_dir():
            raise ValueError(f"got dir {file} expected file")

        # replace all disallowed characters with "_" and trim to 40 chars + 10 random chars
        allowed_stem = "".join(
            char if char in INTERNAL_ALLOWED_CHARS else "_" for char in file.stem
        )
        trimmed_stem = f"{allowed_stem[:40]}{secrets.token_urlsafe(10)}"
        internal_file_map[file] = f"{trimmed_stem}{file.suffix}"

    if len(internal_file_map) != len(files):
        raise ValueError("files must be unique")

    # this should never happend since our random token has 64**10 possibilities
    if len(internal_file_map) != len(set(internal_file_map.values())):
        internal_file_map = get_internal_file_map(files)  # universe heat death

    return internal_file_map


def b64_md5(file: Path) -> str:
    hash_md5 = hashlib.md5()
    with open(file, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    binary_digest = hash_md5.digest()
    return base64.b64encode(binary_digest).decode("utf-8")


class Spec:
    FILES_BY_ID = 1
    FILES_IN_MISSION = 2


class MissionById(NamedTuple):
    id: UUID


class MissionByName(NamedTuple):
    name: str
    project: Union[str, UUID]


class FilesById(NamedTuple):
    ids: List[UUID]


class FilesByMission(NamedTuple):
    mission: MissionById | MissionByName
    files: List[Union[str, UUID]]


class InvalidMissionSpec(Exception): ...


class InvalidFileSpec(Exception): ...


def get_valid_mission_spec(
    mission: Optional[Union[str, UUID]],
    project: Optional[Union[str, UUID]] = None,
) -> Union[MissionById, MissionByName]:
    """\
    checks if:
    - atleast one is speicifed
    - if project is not specified then mission must be a valid uuid4
    """

    if mission is None:
        raise InvalidMissionSpec
    if isinstance(mission, UUID):
        return MissionById(id=mission)
    if isinstance(mission, str) and project is not None:
        return MissionByName(name=mission, project=project)
    raise InvalidMissionSpec


def get_valid_file_spec(
    files: List[Union[str, UUID]],
    mission: Optional[Union[str, UUID]] = None,
    project: Optional[Union[str, UUID]] = None,
) -> Union[FilesById, FilesByMission]:
    """\
    """
    if not any([project, mission, files]):
        raise InvalidFileSpec

    # if only files are specified they must be valid uuid4
    if project is None and mission is None:
        if all(map(lambda file: isinstance(file, UUID), files)):
            return FilesById(ids=files)  # type: ignore
        raise InvalidFileSpec

    mission_spec = get_valid_mission_spec(mission, project)
    return FilesByMission(mission=mission_spec, files=files)


def to_name_or_uuid(s: str) -> Union[UUID, str]:
    if is_valid_uuid4(s):
        return UUID(s)
    return s
