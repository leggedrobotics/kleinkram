from __future__ import annotations

from typing import Any
from typing import Optional

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


class DatatypeNotSupported(Exception): ...


class InvalidMissionMetadata(Exception): ...


class MissionValidationError(Exception): ...


class ProjectValidationError(Exception): ...


class NotAuthenticated(Exception):
    def __init__(self) -> None:
        super().__init__(LOGIN_MESSAGE)


class UpdateCLIVersion(Exception):
    def __init__(self) -> None:
        super().__init__(UPDATE_MESSAGE)


class ExecutionNotFound(Exception): ...


class ExecutionValidationError(Exception): ...


class TemplateNotFound(Exception): ...


class TemplateExists(Exception): ...


class TemplateValidationError(Exception): ...


class TemplateDeletionError(Exception): ...


class TriggerValidationError(Exception): ...


class TriggerNotFound(Exception): ...


class InsufficientStorageError(Exception): ...


class TransferCancelledError(Exception):
    """Raised inside worker threads when the cancel_event is set."""

    pass


TRANSFER_RESULT_ATTR = "transfer_result"


def transfer_interrupted(result: Any) -> KeyboardInterrupt:
    """The exception `upload_files`/`download_files` raise on Ctrl+C, once cleanup is done.

    It is a plain `KeyboardInterrupt`, not a subclass: CPython only exits
    with 130 (by re-raising SIGINT) for that exact type, and a shell loop
    around a script only stops when the script died of SIGINT. What finished
    before the interrupt (an `UploadResult` or `DownloadResult`) is attached
    as `transfer_result`; read it with `get_transfer_result`.
    """
    exc = KeyboardInterrupt("transfer interrupted by user")
    setattr(exc, TRANSFER_RESULT_ATTR, result)
    return exc


def get_transfer_result(exc: BaseException) -> Optional[Any]:
    """The partial result attached by `transfer_interrupted`, or None."""
    return getattr(exc, TRANSFER_RESULT_ATTR, None)


class NotInsideAction(Exception): ...
