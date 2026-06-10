from __future__ import annotations

import logging
import sys
from collections import OrderedDict
from typing import Any
from typing import Callable
from typing import Optional
from typing import Type

import httpx
import typer
from click import ClickException
from rich.console import Console
from rich.panel import Panel

from kleinkram.config import get_config
from kleinkram.config import get_shared_state
from kleinkram.utils import format_traceback
from kleinkram.utils import upper_camel_case_to_words

logger = logging.getLogger(__name__)

ExceptionHandler = Callable[[Any], int]


class ErrorHandledTyper(typer.Typer):
    """\
    error handlers that are last added will be used first
    """

    _error_handlers: OrderedDict[Type[Exception], ExceptionHandler]

    def error_handler(self, exc: Type[Exception]) -> Callable[[ExceptionHandler], ExceptionHandler]:
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


def display_error(
    *,
    exc: Exception,
    verbose: bool,
    title: Optional[str] = None,
    message: Optional[str] = None,
) -> None:
    split_exc_name = upper_camel_case_to_words(type(exc).__name__)
    exc_name = title or " ".join(split_exc_name)
    body = message or str(exc)

    if verbose:
        panel = Panel(
            body,
            title=exc_name,
            style="red",
            border_style="bold",
        )
        Console(file=sys.stderr).print(panel)
    else:
        if title and message:
            print(body, file=sys.stderr)
        else:
            text = f"{type(exc).__name__}"
            if str(exc):
                text += f": {exc}"
            print(text, file=sys.stderr)


def handle_request_error(exc: httpx.RequestError) -> int:
    shared_state = get_shared_state()
    config = get_config()

    selected_endpoint = config.selected_endpoint
    endpoint_url = config.endpoint.api

    # Categorize the request error
    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout, httpx.NetworkError)):
        title = "Connection Failed"
        msg = (
            f"Unable to connect to the Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] (Endpoint name: '{selected_endpoint}')\n\n"
            f"Please verify that:\n"
            f"  1. The server is online and you have a stable network connection.\n"
            f"  2. You are connected to the correct VPN/network if required.\n"
            f"  3. Your endpoint configuration is correct (run [bold]klein endpoint show[/bold] to inspect)."
        )
        quiet_msg = f"Error: Connection failed to {endpoint_url}"

    elif isinstance(exc, (httpx.ReadTimeout, httpx.WriteTimeout, httpx.TimeoutException)):
        title = "Request Timeout"
        msg = (
            f"The request to the Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] timed out.\n\n"
            f"This can happen if:\n"
            f"  1. The server is heavily loaded or performing a slow operation.\n"
            f"  2. The database query or files being processed are very large."
        )
        quiet_msg = f"Error: Request to {endpoint_url} timed out"

    else:
        title = "Network Error"
        msg = (
            f"A network error occurred while communicating with the backend at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan]\n\n"
            f"Details: {exc}"
        )
        quiet_msg = f"Error: Network error on {endpoint_url} ({exc})"

    display_error(
        exc=exc,
        verbose=shared_state.verbose,
        title=title,
        message=msg if shared_state.verbose else quiet_msg,
    )

    logger.error(f"Network error on {endpoint_url}: {exc}")
    logger.error(format_traceback(exc))

    if shared_state.debug:
        raise exc
    return 1


def handle_generic_exception(exc: Exception) -> int:
    shared_state = get_shared_state()

    display_error(exc=exc, verbose=shared_state.verbose)
    logger.error(format_traceback(exc))

    if not shared_state.debug:
        return 1
    raise exc


def handle_http_status_error(exc: httpx.HTTPStatusError) -> int:
    shared_state = get_shared_state()
    config = get_config()
    endpoint_url = config.endpoint.api

    if exc.response.status_code in (502, 504):
        title = "Server Timeout"
        msg = (
            f"The request to the Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] timed out or returned a gateway error.\n\n"
            f"This can happen if:\n"
            f"  1. The server is heavily loaded or performing a slow operation.\n"
            f"  2. The database query or files being processed are very large.\n"
            f"  3. You are experiencing a slow or unstable internet connection."
        )
        quiet_msg = f"Error: Server at {endpoint_url} timed out (HTTP {exc.response.status_code})"
    elif exc.response.status_code == 500:
        title = "Internal Server Error"
        msg = (
            f"The Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] encountered an internal error.\n\n"
            f"Please try again later or contact the administrator."
        )
        quiet_msg = f"Error: Internal server error on {endpoint_url} (HTTP 500)"
    else:
        title = f"HTTP Error {exc.response.status_code}"
        msg = (
            f"The Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] returned an error.\n\n"
            f"Details: {exc}"
        )
        quiet_msg = f"Error: HTTP {exc.response.status_code} on {endpoint_url}"

    display_error(
        exc=exc,
        verbose=shared_state.verbose,
        title=title,
        message=msg if shared_state.verbose else quiet_msg,
    )

    logger.error(f"HTTP error {exc.response.status_code} on {endpoint_url}: {exc}")
    logger.error(format_traceback(exc))

    if shared_state.debug:
        raise exc
    return 1


def register_error_handlers(app: ErrorHandledTyper) -> None:
    """Register all CLI error handlers. Note: since ErrorHandledTyper dispatches
    handlers in reverse order of registration, the most generic Exception handler
    must be registered first, and more specific handlers (like httpx.RequestError) later.
    """
    app.error_handler(Exception)(handle_generic_exception)
    app.error_handler(httpx.RequestError)(handle_request_error)
    app.error_handler(httpx.HTTPStatusError)(handle_http_status_error)
