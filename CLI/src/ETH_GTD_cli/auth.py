import json
import os
import time
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing_extensions import Annotated

from pathlib import Path

import httpx
import requests
import typer

app = typer.Typer()
from .consts import API_URL

TOKEN_FILE = Path(os.path.expanduser("~/.gtd.json"))
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
            print("Token file not found. Please run 'login' command first.")
        except json.JSONDecodeError:
            print("Token file is corrupted. Please run 'login' command again.")
            raise

    def isCliToken(self):
        return "cli_token" in self.tokens[self.endpoint]

    def getAuthToken(self):
        return self.tokens[self.endpoint][AUTH_TOKEN]

    def getRefreshToken(self):
        return self.tokens[self.endpoint][REFRESH_TOKEN]

    def getCLIToken(self):
        return self.tokens[self.endpoint][CLI_KEY]

    def saveTokens(self, tokens):
        self.tokens[self.endpoint] = tokens
        with TOKEN_FILE.open("w") as token_file:
            json.dump(self, token_file)



class OAuthCallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/cli/callback"):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            self.server.auth_tokens = {
                "access_token": params.get("access_token")[0],
                "refresh_token": params.get("refresh_token")[0],
            }
            self.send_response(200)
            self.send_header("Content-type", "text/html")
            self.end_headers()
            self.wfile.write(b"Authentication successful. You can close this window.")
            return

    def log_message(self, format, *args):
        pass


def get_auth_tokens():
    server_address = ("", 8000)
    httpd = HTTPServer(server_address, OAuthCallbackHandler)
    httpd.handle_request()
    return httpd.auth_tokens


class AuthenticatedClient(httpx.Client):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            self.tokenfile = TokenFile()
        except:
            print("Not authenticated. Please run 'GTD auth login'.")

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

        response = self.post(
            f"{API_URL}/auth/refresh-token", json={REFRESH_TOKEN: refresh_token}
        )
        response.raise_for_status()
        new_access_token = response.cookies.get(AUTH_TOKEN)
        new_tokens = {AUTH_TOKEN: new_access_token, REFRESH_TOKEN: refresh_token}
        self.tokenfile.saveTokens(new_tokens)
        self.cookies.set(AUTH_TOKEN, new_access_token)

    def request(self, method, url, *args, **kwargs):
        response = super().request(method, url, *args, **kwargs)
        if (url == f"{API_URL}/auth/refresh-token") and response.status_code == 401:
            print("Refresh token expired. Please login again.")
            response.status_code = 403
            exit(1)
        if response.status_code == 401:
            print("Token expired, refreshing token...")
            self.refresh_token()
            response = super().request(method, url, *args, **kwargs)
        return response


client = AuthenticatedClient()


def login(key: Annotated[str, typer.Option()] = None):
    tokenfile = TokenFile()
    if key:
        tokenfile.saveTokens(key)
    else:
        print("Opening browser for authentication...")
        webbrowser.open(API_URL + "/auth/google?state=cli")

        print("Waiting for authentication to complete...")
        auth_tokens = get_auth_tokens()

        if not auth_tokens:
            print("Failed to get authentication tokens.")
            return

        tokenfile.saveTokens(auth_tokens)

        print("Authentication complete. Tokens saved to tokens.json.")

