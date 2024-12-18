from __future__ import annotations


LOGIN_MESSAGE = "Please login using `klein login`."


class ParsingError(Exception): ...


class InvalidMissionSpec(Exception): ...


class InvalidProjectSpec(Exception): ...


class MissionExists(Exception): ...


class ProjectExists(Exception): ...


class MissionNotFound(Exception): ...


class ProjectNotFound(Exception): ...


class FileNotFound(Exception): ...


class AccessDenied(Exception): ...


class NotAuthenticated(Exception):
    def __init__(self) -> None:
        super().__init__(LOGIN_MESSAGE)


class InvalidCLIVersion(Exception): ...


class FileTypeNotSupported(Exception): ...


class FileNameNotSupported(Exception): ...
