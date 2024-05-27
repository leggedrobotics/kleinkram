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


def get_token():
    try:
        with TOKEN_FILE.open("r") as token_file:
            return json.load(token_file)
    except FileNotFoundError:
        print("Token file not found. Please run 'login' command first.")
        raise
    except json.JSONDecodeError:
        print("Token file is corrupted. Please run 'login' command again.")
        raise


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
            self._load_cookies()
        except:
            print("Not authenticated. Please run 'GTD auth login'.")

    def _load_cookies(self):
        tokens = get_token()
        if "cli_token" in tokens:
            self.cookies.set("cli_token", tokens["cli_token"])
        else:
            self.cookies.set("authtoken", tokens["access_token"])

    def refresh_token(self):
        tokens = get_token()
        refresh_token = tokens.get("refresh_token")
        if not refresh_token:
            print("No refresh token found. Please login again.")
            raise Exception("No refresh token found.")

        response = self.post(
            f"{API_URL}/auth/refresh-token", json={"refreshtoken": refresh_token}
        )
        response.raise_for_status()
        new_access_token = response.cookies.get("authtoken")
        new_tokens = {"access_token": new_access_token, "refresh_token": refresh_token}
        save_token(new_tokens)
        self.cookies.set("authtoken", new_access_token)

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


def login(token: Annotated[str, typer.Option()] = None):
    if token:
        with TOKEN_FILE.open("w") as token_file:
            token_file.write(f"{{\"cli_token\": \"{token}\"}}")
    else:
        print("Opening browser for authentication...")
        webbrowser.open(API_URL + "/auth/google?state=cli")

        print("Waiting for authentication to complete...")
        auth_tokens = get_auth_tokens()

        if not auth_tokens:
            print("Failed to get authentication tokens.")
            return

        save_token(auth_tokens)

        print("Authentication complete. Tokens saved to tokens.json.")


def save_token(tokens):
    with TOKEN_FILE.open("w") as token_file:
        json.dump(tokens, token_file)
