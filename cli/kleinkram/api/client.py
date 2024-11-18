from __future__ import annotations

import httpx
from kleinkram.auth import Config
from kleinkram.config import Credentials
from kleinkram.errors import LOGIN_MESSAGE
from kleinkram.errors import NotAuthenticatedException


COOKIE_AUTH_TOKEN = "authtoken"
COOKIE_REFRESH_TOKEN = "refreshtoken"
COOKIE_CLI_KEY = "clikey"


class AuthenticatedClient(httpx.Client):
    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.config = Config()

        if self.config.has_cli_key:
            assert self.config.cli_key, "unreachable"
            self.cookies.set(COOKIE_CLI_KEY, self.config.cli_key)

        elif self.config.has_refresh_token:
            assert self.config.auth_token is not None, "unreachable"
            self.cookies.set(COOKIE_AUTH_TOKEN, self.config.auth_token)
        else:
            raise NotAuthenticatedException(self.config.endpoint)

    def _refresh_token(self) -> None:
        if self.config.has_cli_key:
            raise RuntimeError

        refresh_token = self.config.refresh_token
        if not refresh_token:
            raise RuntimeError

        self.cookies.set(COOKIE_REFRESH_TOKEN, refresh_token)

        response = self.post(
            "/auth/refresh-token",
        )
        response.raise_for_status()

        new_access_token = response.cookies[COOKIE_AUTH_TOKEN]
        creds = Credentials(auth_token=new_access_token, refresh_token=refresh_token)

        self.config.save_credentials(creds)
        self.cookies.set(COOKIE_AUTH_TOKEN, new_access_token)

    def request(self, method, url, *args, **kwargs):
        full_url = f"{self.config.endpoint}{url}"
        response = super().request(method, full_url, *args, **kwargs)

        if (url == "/auth/refresh-token") and response.status_code == 401:
            raise RuntimeError(LOGIN_MESSAGE)

        if response.status_code == 401:
            try:
                self._refresh_token()
            except Exception:
                raise RuntimeError(LOGIN_MESSAGE)
            return super().request(method, full_url, *args, **kwargs)
        else:
            return response
