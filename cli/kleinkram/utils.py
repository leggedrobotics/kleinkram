from __future__ import annotations

import base64
import glob
import hashlib
import os
import string
from hashlib import md5
from pathlib import Path
from typing import Dict
from typing import Generator
from typing import List
from typing import NamedTuple
from typing import Optional
from typing import Union
from uuid import UUID

import yaml


INTERNAL_ALLOWED_CHARS = string.ascii_letters + string.digits + '_' + '-'


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


def is_valid_uuid4(uuid: str) -> bool:
    try:
        UUID(uuid, version=4)
        return True
    except ValueError:
        return False


def is_valid_name(name: str) -> bool:
    # TODO: this is a placeholder
    return not is_valid_uuid4(name)


class InvalidFilename(Exception): ...


def get_filename(path: Path) -> str:
    """\
    takes a path and returns a sanitized filename

    the format for this internal filename is:
    - replace all disallowed characters with "_"
    - trim to 40 chars + 10 hashed chars
        - the 10 hashed chars are deterministic given the original filename
    """

    stem = ''.join(
        char if char in INTERNAL_ALLOWED_CHARS else '_' for char in path.stem
    )

    if len(stem) > 50:
        hash = md5(path.name.encode()).hexdigest()
        stem = f'{stem[:40]}{hash[:10]}'

    return f'{stem}{path.suffix}'


def get_filename_map(
    file_paths: List[Path], raise_on_change: bool = True
) -> Dict[str, Path]:
    """\
    takes a list of unique filepaths and returns a mapping
    from the original filename to a sanitized internal filename
    see `get_filename` for the internal filename format
    """

    if len(file_paths) != len(set(file_paths)):
        raise ValueError('files paths must be unique')

    internal_file_map = {}
    for file in file_paths:
        if file.is_dir():
            raise ValueError(f'got dir {file} expected file')

        internal_file_map[get_filename(file)] = file

    # this should never happend since our random token has 64**10 possibilities
    if len(internal_file_map) != len(set(internal_file_map.values())):
        raise RuntimeError('hash collision')

    return internal_file_map


def b64_md5(file: Path) -> str:
    hash_md5 = hashlib.md5()
    with open(file, 'rb') as f:
        for chunk in iter(lambda: f.read(4096), b''):
            hash_md5.update(chunk)
    binary_digest = hash_md5.digest()
    return base64.b64encode(binary_digest).decode('utf-8')


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


def load_metadata(path: Path) -> Dict[str, str]:
    if not path.exists():
        raise FileNotFoundError(f'metadata file not found: {path}')
    try:
        with path.open() as f:
            return {str(k): str(v) for k, v in yaml.safe_load(f).items()}
    except Exception as e:
        raise ValueError(f'could not parse metadata file: {e}')
