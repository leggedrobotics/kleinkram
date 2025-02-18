from __future__ import annotations

import pytest

from kleinkram.api.client import _convert_list_data_query_params_values
from kleinkram.api.client import _convert_nested_data_query_params_values
from kleinkram.api.client import _convert_query_params_to_httpx_format


def test_convert_query_params_httpx_format():
    params = {
        "foo": ["foo1", "foo2"],
        "bar": {"k1": "v1", "k2": "v2"},
        "baz": "baz",
    }
    expected = [
        ("foo", "foo1"),
        ("foo", "foo2"),
        ("bar[k1]", "v1"),
        ("bar[k2]", "v2"),
        ("baz", "baz"),
    ]
    assert sorted(_convert_query_params_to_httpx_format(params)) == sorted(expected)


def test_convert_query_params_httpx_format_with_string_conversion():
    o = object()
    params = {
        "invalid": o,
    }
    assert _convert_query_params_to_httpx_format(params) == [("invalid", str(o))]


def test_convert_list_data_query_params_values():
    key = "foo"
    values = ["foo1", "foo2"]
    expected = [("foo", "foo1"), ("foo", "foo2")]
    assert sorted(_convert_list_data_query_params_values(key, values)) == sorted(
        expected
    )


def test_convert_nested_data_query_params_values():
    key = "foo"
    values = {"k1": "v1", "k2": "v2"}
    expected = [("foo[k1]", "v1"), ("foo[k2]", "v2")]
    assert sorted(_convert_nested_data_query_params_values(key, values)) == sorted(
        expected
    )
