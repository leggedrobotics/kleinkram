import json
import os
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing_extensions import Annotated

from pathlib import Path

import httpx
import typer

app = typer.Typer()
from .consts import API_URL

TOKEN_FILE = Path(os.path.expanduser("~/.kleinkram.json"))
REFRESH_TOKEN = "refreshtoken"
AUTH_TOKEN = "authtoken"
CLI_KEY = "clikey"


class TokenFile:
    def __init__(self):
        try:
            with TOKEN_FILE.open("r") as token_file:
                content = json.load(token_file)
                self.endpoint = content["endpoint"]
                self.tokens = content["tokens"]
        except FileNotFoundError:
            self.tokens = {}
            self.endpoint = API_URL
        except json.JSONDecodeError:
            print("Token file is corrupted. Please run 'login' command again.")
            raise

    def isCliToken(self):
        return CLI_KEY in self.tokens[self.endpoint]

    def getAuthToken(self):
        return self.tokens[self.endpoint][AUTH_TOKEN]

    def getRefreshToken(self):
        return self.tokens[self.endpoint][REFRESH_TOKEN]

    def getCLIToken(self):
        return self.tokens[self.endpoint][CLI_KEY]

    def writeToFile(self):
        res = {
            "endpoint": self.endpoint,
            "tokens": self.tokens,
        }
        with TOKEN_FILE.open("w") as token_file:
            json.dump(res, token_file)

    def saveTokens(self, tokens):
        self.tokens[self.endpoint] = tokens
        self.writeToFile()


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/cli/callback"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.server.tokens = {
                AUTH_TOKEN: params.get(AUTH_TOKEN)[0],
                REFRESH_TOKEN: params.get(REFRESH_TOKEN)[0],
            }
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Authentication successful. You can close this window.")
            return
        print("here")

    def log_message(self, format, *args):
        pass


def get_auth_tokens():
    server_address = ("", 8000)
    httpd = HTTPServer(server_address, OAuthCallbackHandler)
    httpd.handle_request()
    return httpd.tokens


class AuthenticatedClient(httpx.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            self.tokenfile = TokenFile()
            self._load_cookies()
        except Exception as e:
            print(f"{self.tokenfile.endpoint} is not authenticated. Please run 'klein login'.")

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
        self.cookies.set(REFRESH_TOKEN, refresh_token, )
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
        if (
                url == "/auth/refresh-token"
        ) and response.status_code == 401:
            print("Refresh token expired. Please login again.")
            response.status_code = 403
            exit(1)
        if response.status_code == 401:
            print("Token expired, refreshing token...")
            self.refresh_token()
            response = super().request(method, self.tokenfile.endpoint + url, *args, **kwargs)
        return response


client = AuthenticatedClient()


def login(
        key: Annotated[str, typer.Option()] = None,
        open_browser: Annotated[bool, typer.Option()] = True,
):
    """Login"""
    tokenfile = TokenFile()
    if key:
        tokenfile.saveTokens(key)
    else:
        url = tokenfile.endpoint + "/auth/google?state=cli"

        has_browser = True
        try:
            browser_available = webbrowser.get()
            if not browser_available:
                raise Exception("No web browser available.")
        except Exception as e:
            has_browser = False

        if has_browser and open_browser:
            webbrowser.open(url)
            auth_tokens = get_auth_tokens()

            if not auth_tokens:
                print("Failed to get authentication tokens.")
                return

            tokenfile.saveTokens(auth_tokens)
            print("Authentication complete. Tokens saved to ~/.kleinkram.json.")

            return

        print(f"Please open the following URL manually in your browser to authenticate: {url + '-no-redirect'}")
        print("Enter the authentication token provided after logging in:")
        manual_auth_token = input("Authentication Token: ")
        manual_refresh_token = input("Refresh Token: ")
        if manual_auth_token:
            tokenfile.saveTokens({AUTH_TOKEN: manual_auth_token, REFRESH_TOKEN: manual_refresh_token})
            print("Authentication complete. Tokens saved to tokens.json.")
        else:
            print("No authentication token provided.")
        return


def setEndpoint(endpoint: Annotated[str, typer.Argument()]):
    """Set the current endpoint"""
    tokenfile = TokenFile()
    tokenfile.endpoint = endpoint
    tokenfile.writeToFile()
    print("Endpoint set to: " + endpoint)
    if tokenfile.endpoint not in tokenfile.tokens:
        print("No tokens found for this endpoint.")


def endpoint():
    """Get the current endpoint"""
    tokenfile = TokenFile()
    print("Current: " + tokenfile.endpoint)
    print("Saved Tokens found for:")
    for _endpoint, _ in tokenfile.tokens.items():
        print(_endpoint)


def setCliKey(key: Annotated[str, typer.Argument()]):
    """Set the CLI key (Actions Only)"""
    tokenfile = TokenFile()
    if not tokenfile.endpoint in tokenfile.tokens:
        tokenfile.tokens[tokenfile.endpoint] = {}
    tokenfile.tokens[tokenfile.endpoint][CLI_KEY] = key
    tokenfile.writeToFile()
