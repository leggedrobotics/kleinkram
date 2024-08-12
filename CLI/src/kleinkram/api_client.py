import httpx

from kleinkram.auth.auth import TokenFile, CLI_KEY, AUTH_TOKEN, REFRESH_TOKEN


class NotAuthenticatedException(Exception):

    def __init__(self, endpoint: str):
        self.message = f"You are not authenticated on endpoint '{endpoint}'. Please run 'klein login' to authenticate."


class AuthenticatedClient(httpx.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        try:
            self.tokenfile = TokenFile()
            self._load_cookies()
        except Exception:
            raise NotAuthenticatedException(self.tokenfile.endpoint)

    def _load_cookies(self):
        if self.tokenfile.isCliToken():
            self.cookies.set(CLI_KEY, self.tokenfile.getCLIToken())
        else:
            self.cookies.set(AUTH_TOKEN, self.tokenfile.getAuthToken())

    def refresh_token(self):
        if self.tokenfile.isCliToken():
            print("CLI key cannot be refreshed.")
            return
        refresh_token = self.tokenfile.getRefreshToken()
        if not refresh_token:
            print("No refresh token found. Please login again.")
            raise Exception("No refresh token found.")
        self.cookies.set(
            REFRESH_TOKEN,
            refresh_token,
        )
        response = self.post(
            "/auth/refresh-token",
        )
        response.raise_for_status()
        new_access_token = response.cookies.get(AUTH_TOKEN)
        new_tokens = {AUTH_TOKEN: new_access_token, REFRESH_TOKEN: refresh_token}
        self.tokenfile.saveTokens(new_tokens)
        self.cookies.set(AUTH_TOKEN, new_access_token)

    def request(self, method, url, *args, **kwargs):
        response = super().request(
            method, self.tokenfile.endpoint + url, *args, **kwargs
        )
        if (url == "/auth/refresh-token") and response.status_code == 401:
            print("Refresh token expired. Please login again.")
            response.status_code = 403
            exit(1)
        if response.status_code == 401:
            print("Token expired, refreshing token...")
            self.refresh_token()
            response = super().request(
                method, self.tokenfile.endpoint + url, *args, **kwargs
            )
        return response
