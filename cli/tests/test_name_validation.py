"""\
the naming rules in `kleinkram/naming.py` mirror the ones of the server and
the web UI (`packages/validation/src/name.validation.ts` and
`filename.validation.ts`); both sides check the shared cases in
`packages/validation/test-cases/names.json`, so they cannot drift apart
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from typing import Dict

import pytest

from kleinkram.core import get_name_validation_error
from kleinkram.core import suggest_name
from kleinkram.naming import SCRIPT_FILENAME_PATTERN
from kleinkram.naming import get_file_name_validation_error
from kleinkram.naming import suggest_file_name

SHARED_CASES_PATH = Path(__file__).resolve().parents[2] / "packages" / "validation" / "test-cases" / "names.json"


def _load_shared_cases() -> Dict[str, Any]:
    if not SHARED_CASES_PATH.exists():  # e.g. tests run from an sdist without the monorepo
        pytest.skip(f"shared naming cases not found at {SHARED_CASES_PATH}", allow_module_level=True)
    return json.loads(SHARED_CASES_PATH.read_text(encoding="utf-8"))


SHARED = _load_shared_cases()


def _ids(cases):
    return [repr(case["value"])[:40] for case in cases]


@pytest.mark.parametrize("case", SHARED["names"]["cases"], ids=_ids(SHARED["names"]["cases"]))
def test_shared_names(case: Dict[str, Any]) -> None:
    assert get_name_validation_error(case["value"], SHARED["names"]["label"]) == case["error"]


@pytest.mark.parametrize("case", SHARED["suggestName"], ids=_ids(SHARED["suggestName"]))
def test_shared_suggest_name(case: Dict[str, Any]) -> None:
    assert suggest_name(case["value"]) == case["suggestion"]


@pytest.mark.parametrize("case", SHARED["fileNames"]["cases"], ids=_ids(SHARED["fileNames"]["cases"]))
def test_shared_file_names(case: Dict[str, Any]) -> None:
    assert get_file_name_validation_error(case["value"], SHARED["fileNames"]["label"]) == case["error"]


@pytest.mark.parametrize("case", SHARED["suggestFileName"], ids=_ids(SHARED["suggestFileName"]))
def test_shared_suggest_file_name(case: Dict[str, Any]) -> None:
    assert suggest_file_name(case["value"]) == case["suggestion"]


@pytest.mark.parametrize("case", SHARED["scriptFileNames"], ids=_ids(SHARED["scriptFileNames"]))
def test_shared_script_file_names(case: Dict[str, Any]) -> None:
    assert bool(SCRIPT_FILENAME_PATTERN.fullmatch(case["value"])) is case["valid"]


def test_label_is_used_as_subject() -> None:
    assert get_name_validation_error("ab", "Mission name") == "Mission name must be at least 3 characters long"
    assert get_file_name_validation_error("a.bag", "Upload").startswith("Upload must be at least 3 characters")
