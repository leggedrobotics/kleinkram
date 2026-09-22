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
from kleinkram.errors import InsufficientStorageError
from kleinkram.errors import NotInsideAction
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
        if title is not None or message is not None:
            print(body, file=sys.stderr)
        else:
            text = f"{type(exc).__name__}"
            if str(exc):
                text += f": {exc}"
            print(text, file=sys.stderr)


def _server_message(response: httpx.Response) -> Optional[str]:
    """\
    extract the explanation the backend sent along with an error

    the backend answers errors with a json body such as
    ``{"statusCode": 503, "message": "..."}``; without this the user only ever
    sees the status code and has to go read the server logs to find out what
    actually went wrong
    """
    try:
        body = response.json()
    except Exception:
        return None

    if isinstance(body, str):
        return body.strip() or None
    if not isinstance(body, dict):
        return None

    message = body.get("message") or body.get("error")
    if isinstance(message, list):
        message = "; ".join(str(item) for item in message)
    if not isinstance(message, str):
        return None
    return message.strip() or None


def handle_request_error(exc: httpx.RequestError) -> int:
    shared_state = get_shared_state()
    config = get_config()

    selected_endpoint = config.selected_endpoint
    endpoint_url = config.endpoint.api

    if isinstance(exc, (httpx.ConnectError, httpx.ConnectTimeout)):
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

    server_message = _server_message(exc.response)

    if exc.response.status_code == 503:
        retry_after = exc.response.headers.get("retry-after")
        detail = server_message or "The server is temporarily unavailable."
        retry_hint = (
            f"This is temporary, please retry in {retry_after} seconds."
            if retry_after
            else "This is temporary, please retry in a moment."
        )
        title = "Service Unavailable"
        msg = (
            f"The Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] could not serve this request.\n\n"
            f"{detail}\n\n{retry_hint}"
        )
        quiet_msg = f"Error: {detail} {retry_hint}"
    elif exc.response.status_code in (502, 504):
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
        detail = server_message or "Please try again later or contact the administrator."
        msg = (
            f"The Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] encountered an internal error.\n\n"
            f"{detail}"
        )
        quiet_msg = f"Error: Internal server error on {endpoint_url} (HTTP 500)"
        if server_message:
            quiet_msg += f": {server_message}"
    else:
        title = f"HTTP Error {exc.response.status_code}"
        details = server_message or str(exc)
        msg = (
            f"The Kleinkram backend server at:\n"
            f"  [bold cyan]{endpoint_url}[/bold cyan] returned an error.\n\n"
            f"Details: {details}"
        )
        quiet_msg = f"Error: HTTP {exc.response.status_code} on {endpoint_url}"
        if server_message:
            quiet_msg += f": {server_message}"

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


def handle_insufficient_storage_error(exc: InsufficientStorageError) -> int:
    shared_state = get_shared_state()
    config = get_config()
    endpoint_url = config.endpoint.api

    title = "Insufficient Storage Space"
    msg = (
        f"The Kleinkram backend server at:\n"
        f"  [bold cyan]{endpoint_url}[/bold cyan] is out of storage space.\n\n"
        f"The requested file upload(s) exceed the remaining capacity of the S3 bucket."
    )
    quiet_msg = "Error: Insufficient storage space on the server"

    display_error(
        exc=exc,
        verbose=shared_state.verbose,
        title=title,
        message=msg if shared_state.verbose else quiet_msg,
    )
    logger.error(f"Insufficient storage error on {endpoint_url}: {exc}")

    if shared_state.debug:
        raise exc
    return 1


def handle_not_inside_action(exc: NotInsideAction) -> int:
    shared_state = get_shared_state()

    title = "Not Inside an Action"
    msg = (
        "This command reports on the action it is running inside, so it only works\n"
        "within a Kleinkram action container.\n\n"
        "Kleinkram sets [bold cyan]KLEINKRAM_ACTION_UUID[/bold cyan] and "
        "[bold cyan]KLEINKRAM_API_KEY[/bold cyan] in every action container;\n"
        "neither is set here."
    )
    quiet_msg = "Error: `klein action` only works inside a running action container"

    display_error(
        exc=exc,
        verbose=shared_state.verbose,
        title=title,
        message=msg if shared_state.verbose else quiet_msg,
    )

    if shared_state.debug:
        raise exc
    return 1


def register_error_handlers(app: ErrorHandledTyper) -> None:
    """Register all CLI error handlers. Note: since ErrorHandledTyper dispatches
    handlers in reverse order of registration, the most generic Exception handler
    must be registered first, and more specific handlers (like httpx.RequestError) later.
    """
    app.error_handler(Exception)(handle_generic_exception)
    app.error_handler(InsufficientStorageError)(handle_insufficient_storage_error)
    app.error_handler(NotInsideAction)(handle_not_inside_action)
    app.error_handler(httpx.RequestError)(handle_request_error)
    app.error_handler(httpx.HTTPStatusError)(handle_http_status_error)
