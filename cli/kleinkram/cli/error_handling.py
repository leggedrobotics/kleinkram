from __future__ import annotations

from collections import OrderedDict
from typing import Any
from typing import Callable
from typing import Type

import typer

ExceptionHandler = Callable[[Exception], int]


class ErrorHandledTyper(typer.Typer):
    """\
    error handlers that are last added will be used first
    """

    _error_handlers: OrderedDict[Type[Exception], ExceptionHandler]

    def error_handler(
        self, exc: Type[Exception]
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
