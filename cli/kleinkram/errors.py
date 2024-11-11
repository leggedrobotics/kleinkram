from __future__ import annotations


class MissionExistsError(Exception): ...


class MissionDoesNotExist(Exception): ...


class NoPermission(Exception): ...


class CorruptedFile(Exception): ...


class NameIsValidUUID(Exception): ...


class FailedUpload(Exception): ...


class InvalidCLIVersion(Exception): ...


class AccessDeniedException(Exception):
    def __init__(self, message: str, api_error: str):
        self.message = message
        self.api_error = api_error


class FileTypeNotSupported(Exception): ...
