from __future__ import annotations

import logging
from typing import Any

import httpx
from kleinkram.auth import Config
from kleinkram.config import Credentials
from kleinkram.errors import LOGIN_MESSAGE
from kleinkram.errors import NotAuthenticatedException

logger = logging.getLogger(__name__)


COOKIE_AUTH_TOKEN = "authtoken"
COOKIE_REFRESH_TOKEN = "refreshtoken"
COOKIE_CLI_KEY = "clikey"


class NotLoggedInException(Exception): ...


class AuthenticatedClient(httpx.Client):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.config = Config()

        if self.config.has_cli_key:
            assert self.config.cli_key, "unreachable"
            logger.info("using cli key...")
            self.cookies.set(COOKIE_CLI_KEY, self.config.cli_key)

        elif self.config.has_refresh_token:
            logger.info("using refresh token...")
            assert self.config.auth_token is not None, "unreachable"
            self.cookies.set(COOKIE_AUTH_TOKEN, self.config.auth_token)
        else:
            logger.info("not authenticated...")
            raise NotAuthenticatedException(self.config.endpoint)

    def _refresh_token(self) -> None:
        if self.config.has_cli_key:
            raise RuntimeError

        refresh_token = self.config.refresh_token
        if not refresh_token:
            raise RuntimeError

        self.cookies.set(COOKIE_REFRESH_TOKEN, refresh_token)

        logger.info("refreshing token...")
        response = self.post(
            "/auth/refresh-token",
        )
        response.raise_for_status()

        new_access_token = response.cookies[COOKIE_AUTH_TOKEN]
        creds = Credentials(auth_token=new_access_token, refresh_token=refresh_token)

        logger.info("saving new tokens...")
        self.config.save_credentials(creds)
        self.cookies.set(COOKIE_AUTH_TOKEN, new_access_token)

    def request(
        self, method: str, url: str | httpx.URL, *args: Any, **kwargs: Any
    ) -> httpx.Response:
        if isinstance(url, httpx.URL):
            raise ValueError("url must be a slug")

        # try to do a request
        full_url = f"{self.config.endpoint}{url}"
        logger.info(f"requesting {method} {full_url}")
        response = super().request(method, full_url, *args, **kwargs)
        logger.info(f"got response {response}")

        # if the requesting a refresh token fails, we are not logged in
        if (url == "/auth/refresh-token") and response.status_code == 401:
            logger.info("got 401, not logged in...")
            raise NotLoggedInException(LOGIN_MESSAGE)

        # otherwise we try to refresh the token
        if response.status_code == 401:
            logger.info("got 401, trying to refresh token...")
            try:
                self._refresh_token()
            except Exception:
                raise NotLoggedInException(LOGIN_MESSAGE)

            logger.info(f"retrying request {method} {full_url}")
            resp = super().request(method, full_url, *args, **kwargs)
            logger.info(f"got response {resp}")
            return resp

        else:
            return response
