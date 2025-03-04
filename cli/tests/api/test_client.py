from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

import httpx
import pytest

import kleinkram.errors
from kleinkram._version import __version__
from kleinkram.api.client import CLI_VERSION_HEADER
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.client import _convert_list_data_query_params_values
from kleinkram.api.client import _convert_nested_data_query_params_values
from kleinkram.api.client import _convert_query_params_to_httpx_format
from kleinkram.config import Config
from kleinkram.config import Credentials
from kleinkram.config import save_config

CONFIG_FILENAME = ".kleinkram.json"


@pytest.fixture
def config_path():
    with TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / CONFIG_FILENAME


@pytest.fixture
def empty_config(config_path):
    test_creds = Credentials(api_key="test")
    config = Config(
        endpoint_credentials={"local": test_creds}, selected_endpoint="local"
    )
    save_config(config, config_path)
    return config_path


def mock_transport(request: httpx.Request) -> httpx.Response:
    assert CLI_VERSION_HEADER in request.headers
    assert request.headers[CLI_VERSION_HEADER] == __version__
    return httpx.Response(200)


def test_client_sending_kleinkram_version_header(empty_config):
    with AuthenticatedClient(
        config_path=empty_config, transport=httpx.MockTransport(mock_transport)
    ) as client:
        resp = client.get("/example")
        assert resp.status_code == 200


def test_client_sending_kleinkram_version_header_with_custom_headers(empty_config):
    with AuthenticatedClient(
        config_path=empty_config, transport=httpx.MockTransport(mock_transport)
    ) as client:
        resp = client.get("/example", headers={"foo": "bar"})
        assert resp.status_code == 200


def test_client_response_on_426_status_code(empty_config):
    def return_426_response(request: httpx.Request) -> httpx.Response:
        _ = request
        return httpx.Response(426)

    with AuthenticatedClient(
        config_path=empty_config, transport=httpx.MockTransport(return_426_response)
    ) as client:
        with pytest.raises(kleinkram.errors.UpdateCLIVersion):
            client.get("/example")


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
