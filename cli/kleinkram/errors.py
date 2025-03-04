from __future__ import annotations

LOGIN_MESSAGE = "Please login using `klein login`."
UPDATE_MESSAGE = "Please update your CLI using `pip install --upgrade kleinkram`."


class ParsingError(Exception): ...


class InvalidFileQuery(Exception): ...


class InvalidMissionQuery(Exception): ...


class InvalidProjectQuery(Exception): ...


class MissionExists(Exception): ...


class ProjectExists(Exception): ...


class MissionNotFound(Exception): ...


class ProjectNotFound(Exception): ...


class FileNotFound(Exception): ...


class AccessDenied(Exception): ...


class InvalidCLIVersion(Exception): ...


class FileTypeNotSupported(Exception): ...


class FileNameNotSupported(Exception): ...


class InvalidMissionMetadata(Exception): ...


class NotAuthenticated(Exception):
    def __init__(self) -> None:
        super().__init__(LOGIN_MESSAGE)


class UpdateCLIVersion(Exception):
    def __init__(self) -> None:
        super().__init__(UPDATE_MESSAGE)
