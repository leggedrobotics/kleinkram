from __future__ import annotations

from unittest.mock import MagicMock
from unittest.mock import patch

import httpx
import pytest

from kleinkram.cli.error_handling import display_error
from kleinkram.cli.error_handling import handle_generic_exception
from kleinkram.cli.error_handling import handle_http_status_error
from kleinkram.cli.error_handling import handle_request_error


class MyException(Exception):
    pass


def test_display_error_not_verbose(capsys):
    exc = MyException("hello")

    display_error(exc=exc, verbose=False)

    out, err = capsys.readouterr()

    assert out == ""
    assert err == "MyException: hello\n"

    exc = MyException()

    display_error(exc=exc, verbose=False)

    out, err = capsys.readouterr()

    assert out == ""
    assert err == "MyException\n"


def test_display_error_verbose(capsys):
    exc = MyException("hello")

    display_error(exc=exc, verbose=True)

    out, err = capsys.readouterr()

    assert out == ""
    assert err == (
        "╭──────────────────────────────── My Exception ────────────────────────────────╮\n"
        "│ hello                                                                        │\n"
        "╰──────────────────────────────────────────────────────────────────────────────╯\n"
    )


def _run_handle_request_error(capsys, exc, verbose, debug, expected_title, expected_texts, should_raise):
    mock_config = MagicMock()
    mock_config.selected_endpoint = "my-dev"
    mock_config.endpoint.api = "http://my-api-url.com"

    mock_state = MagicMock()
    mock_state.verbose = verbose
    mock_state.debug = debug

    with patch("kleinkram.cli.error_handling.get_config", return_value=mock_config), patch(
        "kleinkram.cli.error_handling.get_shared_state", return_value=mock_state
    ):

        if should_raise:
            with pytest.raises(type(exc)):
                handle_request_error(exc)
        else:
            exit_code = handle_request_error(exc)
            assert exit_code == 1
            out, err = capsys.readouterr()
            assert out == ""
            if expected_title:
                assert expected_title in err
            if expected_texts:
                if isinstance(expected_texts, str):
                    assert expected_texts in err
                else:
                    for text in expected_texts:
                        assert text in err


def test_handle_generic_exception_verbose(capsys):
    mock_state = MagicMock()
    mock_state.verbose = True
    mock_state.debug = False

    exc = Exception("something went wrong")

    with patch("kleinkram.cli.error_handling.get_shared_state", return_value=mock_state):
        exit_code = handle_generic_exception(exc)

    assert exit_code == 1
    out, err = capsys.readouterr()
    assert "something went wrong" in err


def test_handle_generic_exception_debug():
    mock_state = MagicMock()
    mock_state.verbose = True
    mock_state.debug = True

    exc = Exception("something went wrong")

    with patch("kleinkram.cli.error_handling.get_shared_state", return_value=mock_state):
        with pytest.raises(Exception, match="something went wrong"):
            handle_generic_exception(exc)


@pytest.mark.parametrize(
    "exc, verbose, debug, expected_title, expected_texts, should_raise",
    [
        (
            httpx.ConnectError("refused"),
            True,
            False,
            "Connection Failed",
            ["Unable to connect", "http://my-api-url.com", "my-dev"],
            False,
        ),
        (httpx.ConnectError("refused"), False, False, None, "Error: Connection failed to http://my-api-url.com", False),
        (httpx.ConnectError("refused"), True, True, None, None, True),
        (httpx.ReadTimeout("timeout"), True, False, "Request Timeout", ["timed out", "http://my-api-url.com"], False),
        (httpx.ReadTimeout("timeout"), False, False, None, "Error: Request to http://my-api-url.com timed out", False),
        (
            httpx.RequestError("Invalid", request=MagicMock()),
            True,
            False,
            "Network Error",
            ["Details: Invalid", "http://my-api-url.com"],
            False,
        ),
        (
            httpx.RequestError("Invalid", request=MagicMock()),
            False,
            False,
            None,
            "Error: Network error on http://my-api-url.com (Invalid)",
            False,
        ),
        (
            httpx.ReadError("connection reset", request=MagicMock()),
            True,
            False,
            "Network Error",
            ["Details: connection reset", "http://my-api-url.com"],
            False,
        ),
        (
            httpx.WriteError("write failed", request=MagicMock()),
            True,
            False,
            "Network Error",
            ["Details: write failed", "http://my-api-url.com"],
            False,
        ),
    ],
)
def test_handle_request_error_parameterized(capsys, exc, verbose, debug, expected_title, expected_texts, should_raise):
    _run_handle_request_error(capsys, exc, verbose, debug, expected_title, expected_texts, should_raise)


def _run_handle_http_status_error(capsys, exc, verbose, debug, expected_title, expected_texts, should_raise):
    mock_config = MagicMock()
    mock_config.selected_endpoint = "my-dev"
    mock_config.endpoint.api = "http://my-api-url.com"

    mock_state = MagicMock()
    mock_state.verbose = verbose
    mock_state.debug = debug

    with patch("kleinkram.cli.error_handling.get_config", return_value=mock_config), patch(
        "kleinkram.cli.error_handling.get_shared_state", return_value=mock_state
    ):
        if should_raise:
            with pytest.raises(type(exc)):
                handle_http_status_error(exc)
        else:
            exit_code = handle_http_status_error(exc)
            assert exit_code == 1
            out, err = capsys.readouterr()
            assert out == ""
            if expected_title:
                assert expected_title in err
            if expected_texts:
                if isinstance(expected_texts, str):
                    assert expected_texts in err
                else:
                    for text in expected_texts:
                        assert text in err


@pytest.mark.parametrize(
    "status_code, verbose, debug, expected_title, expected_texts, should_raise",
    [
        (504, True, False, "Server Timeout", ["timed out or returned a gateway error", "http://my-api-url.com"], False),
        (504, False, False, None, "Error: Server at http://my-api-url.com timed out (HTTP 504)", False),
        (500, True, False, "Internal Server Error", ["encountered an internal error", "http://my-api-url.com"], False),
        (500, False, False, None, "Error: Internal server error on http://my-api-url.com (HTTP 500)", False),
        (400, True, False, "HTTP Error 400", ["returned an error", "http://my-api-url.com"], False),
        (400, False, False, None, "Error: HTTP 400 on http://my-api-url.com", False),
        (504, True, True, None, None, True),
    ],
)
def test_handle_http_status_error_parameterized(
    capsys, status_code, verbose, debug, expected_title, expected_texts, should_raise
):
    request = httpx.Request("GET", "http://my-api-url.com")
    response = httpx.Response(status_code, request=request)
    exc = httpx.HTTPStatusError("error", request=request, response=response)
    _run_handle_http_status_error(capsys, exc, verbose, debug, expected_title, expected_texts, should_raise)


def _http_status_error(status_code, json=None, headers=None):
    request = httpx.Request("POST", "http://my-api-url.com/actions")
    response = httpx.Response(status_code, request=request, json=json, headers=headers)
    return httpx.HTTPStatusError("error", request=request, response=response)


@pytest.mark.parametrize("verbose", [True, False])
def test_handle_http_status_error_surfaces_server_message(capsys, verbose):
    """the backend explanation must reach the user, not just the status code"""
    exc = _http_status_error(409, json={"statusCode": 409, "message": "Creator no longer has access to this mission"})
    _run_handle_http_status_error(
        capsys,
        exc,
        verbose,
        False,
        "HTTP Error 409" if verbose else None,
        ["Creator no longer has access to this mission"],
        False,
    )


@pytest.mark.parametrize("verbose", [True, False])
def test_handle_http_status_error_reports_service_unavailable(capsys, verbose):
    """both output modes must carry the explanation and the retry delay"""
    exc = _http_status_error(
        503,
        json={"statusCode": 503, "message": "The action log store (Loki) is not ready yet."},
        headers={"Retry-After": "15"},
    )
    _run_handle_http_status_error(
        capsys,
        exc,
        verbose,
        False,
        "Service Unavailable" if verbose else None,
        ["action log store (Loki) is not ready", "retry in 15 seconds"],
        False,
    )


@pytest.mark.parametrize("verbose", [True, False])
def test_handle_http_status_error_service_unavailable_without_retry_after(capsys, verbose):
    exc = _http_status_error(503, json={"statusCode": 503, "message": "Database is failing over."})
    _run_handle_http_status_error(capsys, exc, verbose, False, None, ["Database is failing over.", "retry in a moment"], False)


@pytest.mark.parametrize("verbose", [True, False])
def test_handle_http_status_error_surfaces_server_message_on_500(capsys, verbose):
    """a 500 with a specific backend message must not be flattened to boilerplate"""
    exc = _http_status_error(500, json={"statusCode": 500, "message": "Storage backend rejected the write"})
    _run_handle_http_status_error(capsys, exc, verbose, False, None, ["Storage backend rejected the write"], False)


def test_handle_http_status_error_joins_validation_message_lists(capsys):
    exc = _http_status_error(400, json={"statusCode": 400, "message": ["name must be a string", "name is required"]})
    _run_handle_http_status_error(
        capsys, exc, True, False, "HTTP Error 400", ["name must be a string; name is required"], False
    )


def test_handle_http_status_error_without_json_body(capsys):
    """a non-json error body must not break the handler"""
    request = httpx.Request("GET", "http://my-api-url.com")
    response = httpx.Response(502, request=request, content=b"<html>bad gateway</html>")
    exc = httpx.HTTPStatusError("error", request=request, response=response)
    _run_handle_http_status_error(capsys, exc, True, False, "Server Timeout", ["http://my-api-url.com"], False)
