from __future__ import annotations

LOGIN_MESSAGE = "Please login using `klein login`."


class InvalidMissionSpec(Exception): ...


class InvalidFileSpec(Exception): ...


class MissionExists(Exception): ...


class MissionDoesNotExist(Exception): ...


class NoPermission(Exception): ...


class AccessDeniedException(Exception):
    def __init__(self, message: str, api_error: str):
        self.message = message
        self.api_error = api_error


class NotAuthenticatedException(Exception):
    def __init__(self, endpoint: str):
        message = (
            f"You are not authenticated on endpoint '{endpoint}'.\n{LOGIN_MESSAGE}"
        )
        super().__init__(message)


class CorruptedFile(Exception): ...


class NameIsValidUUID(Exception): ...


class UploadFailed(Exception): ...


class InvalidCLIVersion(Exception): ...


class FileTypeNotSupported(Exception): ...


class InvalidConfigFile(Exception):
    def __init__(self) -> None:
        super().__init__("Invalid config file.")


class CorruptedConfigFile(Exception):
    def __init__(self) -> None:
        super().__init__(
            "Config file is corrupted.\nPlease run `klein login` to re-authenticate."
        )
