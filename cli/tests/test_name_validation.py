from __future__ import annotations

import pytest

from kleinkram.core import get_name_validation_error
from kleinkram.core import suggest_name


@pytest.mark.parametrize(
    "name",
    [
        "abc",
        "field-testing-2024",
        "2024-05-14_calibration-run",
        "v1.2",
        "a" * 100,
    ],
)
def test_valid_names(name: str) -> None:
    assert get_name_validation_error(name) is None


@pytest.mark.parametrize(
    "name, message",
    [
        ("", "Name is required"),
        ("ab", "Name must be at least 3 characters long"),
        ("a" * 101, "Name must be at most 100 characters long"),
        ("3f2ad2c6-6e2a-4c6b-9a1d-9f6f0f3b7f21", "Name must not be a UUID"),
        (".hidden", "Name must not start with '.'. Try \"hidden\"."),
        ("...", "Name must not start with '.'."),
        (
            "My Project",
            "Name may only contain letters, digits, '.', '-' and '_' (found space). Try \"My-Project\".",
        ),
        (
            "Müller: run 1",
            "Name may only contain letters, digits, '.', '-' and '_' (found 'ü', ':', space). Try \"Muller-run-1\".",
        ),
        ("abc\n", "Name may only contain letters, digits, '.', '-' and '_' (found '\n'). Try \"abc\"."),
    ],
)
def test_invalid_names(name: str, message: str) -> None:
    assert get_name_validation_error(name) == message


def test_label_is_used_as_subject() -> None:
    assert get_name_validation_error("ab", "Mission name") == "Mission name must be at least 3 characters long"


def test_suggestion_is_none_if_nothing_valid_remains() -> None:
    assert suggest_name("日本") is None
