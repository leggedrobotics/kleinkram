from __future__ import annotations

import base64
import json
import logging
import time
from collections import abc
from pathlib import Path
from threading import Lock
from typing import Any
from typing import List
from typing import Mapping
from typing import Optional
from typing import Sequence
from typing import Tuple
from typing import Union

import httpx
from httpx._types import PrimitiveData

import kleinkram.errors
from kleinkram._version import __version__
from kleinkram.config import CONFIG_PATH
from kleinkram.config import Config
from kleinkram.config import Credentials
from kleinkram.config import get_config
from kleinkram.config import update_saved_credentials
from kleinkram.errors import NoEndpointConfigured
from kleinkram.errors import NotAuthenticated
from kleinkram.errors import UpdateCLIVersion

logger = logging.getLogger(__name__)


COOKIE_AUTH_TOKEN = "authtoken"
COOKIE_REFRESH_TOKEN = "refreshtoken"
COOKIE_API_KEY = "clikey"

CLI_VERSION_HEADER = "Kleinkram-Client-Version"


Data = Union[PrimitiveData, Any]
NestedData = Mapping[str, Data]
ListData = Sequence[Data]
QueryParams = Mapping[str, Union[Data, NestedData, ListData]]


def _convert_nested_data_query_params_values(key: str, values: NestedData) -> List[Tuple[str, Data]]:
    return [(f"{key}[{k}]", v) for k, v in values.items()]


def _convert_list_data_query_params_values(key: str, values: ListData) -> List[Tuple[str, Data]]:
    return [(key, value) for value in values]


def _convert_query_params_to_httpx_format(
    params: QueryParams,
) -> List[Tuple[str, Data]]:
    ret: List[Tuple[str, Data]] = []
    for key, value in params.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            ret.append((key, value))
        elif isinstance(value, abc.Mapping):
            ret.extend(_convert_nested_data_query_params_values(key, value))
        elif isinstance(value, abc.Sequence):
            ret.extend(_convert_list_data_query_params_values(key, value))
        else:  # TODO: handle this better
            ret.append((key, str(value)))
    return ret


def _access_token_expired(token: str, leeway: float = 30.0) -> bool:
    """\
    whether a JWT access token is (about to be) expired, read from its `exp`
    claim without checking the signature (the server does that)
    """
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        exp = json.loads(base64.urlsafe_b64decode(payload)).get("exp")
    except (IndexError, ValueError):
        return True
    if not isinstance(exp, (int, float)):
        return False
    return exp <= time.time() + leeway


class AuthenticatedClient(httpx.Client):
    _config: Config
    _config_lock: Lock

    def __init__(self, config_path: Path = CONFIG_PATH, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("timeout", 60.0)
        super().__init__(*args, **kwargs)

        self._config = get_config(path=config_path)
        self._config_path = config_path
        self._config_lock = Lock()

        if not self._config.has_endpoint:
            raise NoEndpointConfigured()
        if self._config.credentials is None:
            logger.info("not authenticated...")
            raise NotAuthenticated
        elif (api_key := self._config.credentials.api_key) is not None:
            logger.info("using cli key...")
            self.cookies.set(COOKIE_API_KEY, api_key)
        else:
            logger.info("using refresh token...")
            assert self._config.credentials.auth_token is not None, "unreachable"
            self.cookies.set(COOKIE_AUTH_TOKEN, self._config.credentials.auth_token)

    def _refresh_token(self) -> None:
        if self._config.credentials is None:
            raise NotAuthenticated

        if self._config.credentials.api_key is not None:
            raise RuntimeError("cannot refresh token when using cli key auth")

        name = self._config.selected_endpoint
        assert name is not None, "unreachable"
        failed_access_token = self._config.credentials.auth_token
        in_memory = self._config.credentials

        def refresh(on_disk: Optional[Credentials]) -> Credentials:
            current = on_disk or in_memory
            # another thread or `klein` process refreshed in the meantime:
            # use its tokens instead of presenting an already rotated one
            if (
                current.auth_token is not None
                and current.auth_token != failed_access_token
                and not _access_token_expired(current.auth_token)
            ):
                logger.info("using tokens refreshed by another process...")
                return current
            if current.refresh_token is None:
                raise NotAuthenticated

            logger.info("refreshing token...")
            self.cookies.clear()
            self.cookies.set(COOKIE_REFRESH_TOKEN, current.refresh_token)
            response = self.post("/auth/refresh-token")
            response.raise_for_status()
            # the server rotates the refresh token: the old one stops working
            # shortly, so the new one must be saved
            return Credentials(
                auth_token=response.cookies[COOKIE_AUTH_TOKEN],
                refresh_token=response.cookies.get(COOKIE_REFRESH_TOKEN) or current.refresh_token,
            )

        with self._config_lock:
            new = update_saved_credentials(name, refresh, self._config_path)

        assert new is not None and new.auth_token is not None, "unreachable"
        self.cookies.clear()
        self.cookies.set(COOKIE_AUTH_TOKEN, new.auth_token)

    def _send_request_with_kleinkram_headers(self, *args: Any, **kwargs: Any) -> httpx.Response:
        # add the cli version to the headers
        headers = kwargs.get("headers") or {}
        headers.setdefault(CLI_VERSION_HEADER, __version__)
        kwargs["headers"] = headers

        # send the request
        response = super().request(*args, **kwargs)

        # check version compatibility
        if response.status_code == 426:
            raise UpdateCLIVersion()
        return response

    def request(
        self,
        method: str,
        url: str | httpx.URL,
        params: QueryParams | None = None,
        *args: Any,
        **kwargs: Any,
    ) -> httpx.Response:
        if isinstance(url, httpx.URL):
            raise NotImplementedError(f"`httpx.URL` is not supported {url!r}")
        if not url.startswith("/"):
            url = f"/{url}"

        # try to do a request
        full_url = f"{self._config.endpoint.api}{url}"
        logger.info(f"requesting {method} {full_url}")

        httpx_params = _convert_query_params_to_httpx_format(params or {})
        response = self._send_request_with_kleinkram_headers(method, full_url, params=httpx_params, *args, **kwargs)

        logger.info(f"got response {response}")

        # if the requesting a refresh token fails, we are not logged in
        if (url == "/auth/refresh-token") and response.status_code == 401:
            logger.info("got 401, not logged in...")
            raise NotAuthenticated

        # otherwise we try to refresh the token
        if response.status_code == 401:
            logger.info("got 401, trying to refresh token...")
            try:
                self._refresh_token()
            except Exception:
                raise NotAuthenticated

            logger.info(f"retrying request {method} {full_url}")
            response = self._send_request_with_kleinkram_headers(method, full_url, params=httpx_params, *args, **kwargs)
            logger.info(f"got response {response}")
            return response
        else:
            return response

    def delete(  # type: ignore[override]
        self,
        url: str | httpx.URL,
        *,
        params: QueryParams | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        return self.request("DELETE", url, params=params, **kwargs)
