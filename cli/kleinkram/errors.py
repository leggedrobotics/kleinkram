from __future__ import annotations

from typing import Any
from typing import Callable
from typing import OrderedDict
from typing import Type

import typer

LOGIN_MESSAGE = "Please login using `klein login`."
INVALID_CONFIG_MESSAGE = "Invalid config file."


class ParsingError(Exception): ...


class InvalidMissionSpec(Exception): ...


class InvalidProjectSpec(Exception): ...


class MissionExists(Exception): ...


class MissionNotFound(Exception): ...


class ProjectNotFound(Exception): ...


class AccessDenied(Exception): ...


class NotAuthenticated(Exception):
    def __init__(self) -> None:
        super().__init__(LOGIN_MESSAGE)


class CorruptedFile(Exception): ...


class UploadFailed(Exception): ...


class UploadCredentialsFailed(UploadFailed): ...


class CancelUploadFailed(UploadFailed): ...


class ConfirmUploadFailed(UploadFailed): ...


class DownloadFailed(Exception): ...


class InvalidCLIVersion(Exception): ...


class FileTypeNotSupported(Exception): ...


class InvalidConfigFile(Exception):
    def __init__(self) -> None:
        super().__init__(INVALID_CONFIG_MESSAGE)


ExceptionHandler = Callable[[Exception], int]


class ErrorHandledTyper(typer.Typer):
    """\
    error handlers that are last added will be used first
    """

    _error_handlers: OrderedDict[Type[Exception], ExceptionHandler]

    def error_handler(
        self, exc: type[Exception]
    ) -> Callable[[ExceptionHandler], ExceptionHandler]:
        def dec(func: ExceptionHandler) -> ExceptionHandler:
            self._error_handlers[exc] = func
            return func

        return dec

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self._error_handlers = OrderedDict()

    def __call__(self, *args: Any, **kwargs: Any) -> int:
        try:
            return super().__call__(*args, **kwargs)
        except Exception as e:
            for tp, handler in reversed(self._error_handlers.items()):
                if isinstance(e, tp):
                    exit_code = handler(e)
                    raise SystemExit(exit_code)
            raise
