import typing

import typer
from httpx import HTTPStatusError, ReadError, RemoteProtocolError
from rich.console import Console
from rich.panel import Panel
from typer import Typer

from kleinkram.api_client import NotAuthenticatedException

ExceptionType = "typing.Type[Exception]"
ErrorHandlingCallback = typing.Callable[[Exception], int]


class AccessDeniedException(Exception):

    def __init__(self, message: str, api_error: str):
        self.message = message
        self.api_error = api_error


def not_yet_implemented_handler(e: Exception):
    console = Console()
    panel = Panel(
        "This feature is not yet implemented, please check for updates.",
        title="Not Yet Implemented",
        style="yellow",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


def not_authenticated_handler(e: NotAuthenticatedException):
    console = Console()
    panel = Panel(
        f"{e.message}\n » Please run 'klein login' to authenticate.",
        title="Not Authenticated",
        style="yellow",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


def access_denied_handler(e: AccessDeniedException):
    console = Console()
    panel = Panel(
        f"{e.message}\n » API Response: {e.api_error}",
        title="Access Denied",
        style="red",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


def value_error_handler(e: Exception):
    console = Console()
    panel = Panel(
        str(e),
        title="Invalid Argument",
        style="red",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


def http_status_error_handler(e: HTTPStatusError):
    console = Console()
    panel = Panel(
        f"An HTTP error occurred: {e}\n\n » Please report this error to the developers.",
        title="HTTP Status Error",
        style="red",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


def remote_down_handler(e: Exception):
    console = Console()
    panel = Panel(
        f"An error occurred while communicating with the remote server: {e}\n"
        f"\n » The server may be down or unreachable; please try again.",
        title="Remote Protocol Error",
        style="yellow",
        padding=(1, 2),
        highlight=True,
    )
    print()
    console.print(panel)
    print()


class ErrorHandledTyper(Typer):
    error_handlers: typing.Dict[ExceptionType, ErrorHandlingCallback] = {
        NotAuthenticatedException: not_authenticated_handler,
        AccessDeniedException: access_denied_handler,
        HTTPStatusError: http_status_error_handler,
        NotImplementedError: not_yet_implemented_handler,
        ValueError: value_error_handler,
        RemoteProtocolError: remote_down_handler,
        ReadError: remote_down_handler,
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def error_handler(self, exc: ExceptionType):
        def decorator(f: ErrorHandlingCallback):
            self.error_handlers[exc] = f
            return f

        return decorator

    def __call__(self, *args, **kwargs):
        try:
            super(ErrorHandledTyper, self).__call__(*args, **kwargs)

        except Exception as e:

            # exit with error code 1 if no error handler is defined
            if type(e) not in self.error_handlers:
                typer.secho(
                    f"An unhanded error of type {type(e).__name__} occurred.",
                    fg=typer.colors.RED,
                )
                typer.secho(str(e), fg=typer.colors.RED)
                typer.secho(
                    " » Please report this error to the developers.",
                    fg=typer.colors.RED,
                )
            else:
                self.error_handlers[type(e)](e)

            # exit with error code 1
            exit(1)
