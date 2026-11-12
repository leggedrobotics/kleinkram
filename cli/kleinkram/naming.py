"""\
naming rules for projects, missions, access groups, templates, triggers and
files, mirrored from `packages/validation/src/name.validation.ts` and
`packages/validation/src/filename.validation.ts`

Both sides are tested against the shared cases in
`packages/validation/test-cases/names.json` (see `tests/test_name_validation.py`),
so a change on one side without the other fails the tests.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Optional
from typing import Tuple

# --------------------------------------------------------------------------
# names: projects, missions, access groups, templates, triggers
# --------------------------------------------------------------------------

NAME_MIN_LENGTH = 3
NAME_MAX_LENGTH = 100
NAME_ALLOWED_CHARACTERS = r"A-Za-z0-9_.\-"
# must not start with '.' (a hidden directory) or '-' (read as an option on a command line)
NAME_REGEX = re.compile(rf"^(?![.-])[{NAME_ALLOWED_CHARACTERS}]{{{NAME_MIN_LENGTH},{NAME_MAX_LENGTH}}}$")
_INVALID_CHARACTER_REGEX = re.compile(rf"[^{NAME_ALLOWED_CHARACTERS}]")
UUID_REGEX = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def suggest_name(name: str) -> Optional[str]:
    """\
    turns an invalid name into a valid one, e.g. `My Project` into `My-Project`,
    returns None if no valid name can be derived
    """
    # drop accents: ü -> u
    suggestion = "".join(c for c in unicodedata.normalize("NFKD", name) if not unicodedata.combining(c))
    suggestion = re.sub(rf"[^{NAME_ALLOWED_CHARACTERS}]+", "-", suggestion)
    suggestion = re.sub(r"-{2,}", "-", suggestion)
    suggestion = re.sub(r"^[.-]+", "", suggestion)
    suggestion = re.sub(r"-+$", "", suggestion)[:NAME_MAX_LENGTH]

    if NAME_REGEX.fullmatch(suggestion) and not UUID_REGEX.fullmatch(suggestion):
        return suggestion
    return None


def name_character_problem(name: str, label: str) -> str:
    """what is wrong with the characters of a name that has a valid length"""
    invalid_characters = list(dict.fromkeys(_INVALID_CHARACTER_REGEX.findall(name)))
    if invalid_characters:
        found = ", ".join("space" if c == " " else f"'{c}'" for c in invalid_characters)
        return f"{label} may only contain letters, digits, '.', '-' and '_' (found {found})"
    return f"{label} must not start with '.' or '-'"


def get_name_validation_error(name: str, label: str = "Name") -> Optional[str]:
    """\
    returns a human-readable error for an invalid name or None if it is valid,
    `label` is used as the subject of the message, e.g. "Project name"
    """
    if not name:
        return f"{label} is required"
    if len(name) < NAME_MIN_LENGTH:
        return f"{label} must be at least {NAME_MIN_LENGTH} characters long"
    if len(name) > NAME_MAX_LENGTH:
        return f"{label} must be at most {NAME_MAX_LENGTH} characters long"
    if UUID_REGEX.fullmatch(name):
        return f"{label} must not be a UUID"
    if NAME_REGEX.fullmatch(name):
        return None

    problem = name_character_problem(name, label)
    suggestion = suggest_name(name)
    return f'{problem}. Try "{suggestion}".' if suggestion else f"{problem}."


# --------------------------------------------------------------------------
# files: the part before the extension follows the name rules, 3 to 50
# characters; the extension is a supported type, in lowercase
# --------------------------------------------------------------------------

FILENAME_MIN_LENGTH = 3
FILENAME_MAX_LENGTH = 50
# the order of `FileType` in packages/shared, then `.yml`; it appears in messages
FILE_EXTENSIONS = (".bag", ".mcap", ".yaml", ".svo2", ".tum", ".db3", ".md", ".csv", ".yml")
_FILE_NAME_REGEX = re.compile(
    rf"^(?![.-])[{NAME_ALLOWED_CHARACTERS}]{{{FILENAME_MIN_LENGTH},{FILENAME_MAX_LENGTH}}}"
    rf"\.({'|'.join(extension[1:] for extension in FILE_EXTENSIONS)})$"
)


def split_file_name(filename: str) -> Tuple[str, str]:
    """`name.ext` -> (`name`, `.ext`), like `splitFileName` (a leading dot is not an extension)"""
    last_dot = filename.rfind(".")
    if last_dot <= 0:
        return filename, ""
    return filename[:last_dot], filename[last_dot:]


def suggest_file_name(filename: str) -> Optional[str]:
    """\
    turns an invalid file name into a valid one, e.g. `run 1.MCAP` into
    `run-1.mcap`, returns None if no valid name can be derived
    """
    name, extension = split_file_name(filename)
    lower_extension = extension.lower()
    if lower_extension not in FILE_EXTENSIONS:
        return None
    suggestion = suggest_name(name[:FILENAME_MAX_LENGTH])
    if suggestion is None:
        return None
    candidate = suggestion[:FILENAME_MAX_LENGTH] + lower_extension
    return candidate if get_file_name_validation_error(candidate) is None else None


def get_file_name_validation_error(filename: str, label: str = "File name") -> Optional[str]:
    """returns a human-readable error for an invalid file name or None if it is valid"""
    if not filename:
        return f"{label} is required"

    name, extension = split_file_name(filename)
    if extension not in FILE_EXTENSIONS:
        if extension.lower() in FILE_EXTENSIONS:
            return f'{label} must end with a lowercase extension. Try "{name}{extension.lower()}".'
        return f"{label} must end with one of {', '.join(FILE_EXTENSIONS)}"

    if len(name) < FILENAME_MIN_LENGTH:
        return f"{label} must be at least {FILENAME_MIN_LENGTH} characters long without the extension"
    if len(name) > FILENAME_MAX_LENGTH:
        return f"{label} must be at most {FILENAME_MAX_LENGTH} characters long without the extension"
    if UUID_REGEX.fullmatch(name):
        return f"{label} must not be a UUID"
    if _FILE_NAME_REGEX.fullmatch(filename):
        return None

    problem = name_character_problem(name, label)
    suggestion = suggest_file_name(filename)
    return f'{problem}. Try "{suggestion}".' if suggestion else f"{problem}."


# --------------------------------------------------------------------------
# scripts for `klein action run-script`, see `SCRIPT_FILENAME_REGEX`; spelled
# out because `\w` matches any letter in Python but only ASCII in JavaScript
# --------------------------------------------------------------------------

SCRIPT_FILENAME_PATTERN = re.compile(r"^[A-Za-z0-9_.-]{1,96}\.py$")
