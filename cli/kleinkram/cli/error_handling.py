from __future__ import annotations

import sys
from collections import OrderedDict
from typing import Any
from typing import Callable
from typing import Type

import typer
from click import ClickException
from rich.console import Console
from rich.panel import Panel

from kleinkram.utils import upper_camel_case_to_words

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
            if isinstance(e, ClickException):
                raise
            for tp, handler in reversed(self._error_handlers.items()):
                if isinstance(e, tp):
                    exit_code = handler(e)
                    raise SystemExit(exit_code)
            raise


def display_error(*, exc: Exception, verbose: bool) -> None:
    split_exc_name = upper_camel_case_to_words(type(exc).__name__)

    if verbose:
        panel = Panel(
            str(exc),  # get the error message
            title=" ".join(split_exc_name),
            style="red",
            border_style="bold",
        )
        Console(file=sys.stderr).print(panel)
    else:
        text = f"{type(exc).__name__}"
        if str(exc):
            text += f": {exc}"
        print(text, file=sys.stderr)
