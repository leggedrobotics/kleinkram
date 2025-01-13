from __future__ import annotations

import pytest

from kleinkram.cli.error_handling import display_error


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
