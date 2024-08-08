import json
import os
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Optional

import typer
from typing_extensions import Annotated

from kleinkram.consts import API_URL

app = typer.Typer()

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
        self.tokens[self.endpoint][CLI_KEY] = {}
        self.tokens[self.endpoint][CLI_KEY] = tokens
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


def logout():
    """
    Logout from the currently set endpoint.
    """
    tokenfile = TokenFile()
    tokenfile.tokens[tokenfile.endpoint] = {}
    tokenfile.writeToFile()
    print("Logged out.")


def login(
    key: Optional[str] = typer.Option(None, help="CLI Key", hidden=True),
    open_browser: Optional[bool] = typer.Option(
        True, help="Open browser for authentication"
    ),
):
    """
    Login into the currently set endpoint.\n
    By default, it will open the browser for authentication. On machines without a browser, you can manually open the URL provided and paste the tokens back.
    """
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

        print(
            f"Please open the following URL manually in your browser to authenticate: {url + '-no-redirect'}"
        )
        print("Enter the authentication token provided after logging in:")
        manual_auth_token = input("Authentication Token: ")
        manual_refresh_token = input("Refresh Token: ")
        if manual_auth_token:
            tokenfile.saveTokens(
                {AUTH_TOKEN: manual_auth_token, REFRESH_TOKEN: manual_refresh_token}
            )
            print("Authentication complete. Tokens saved to tokens.json.")
        else:
            print("No authentication token provided.")
        return


def setEndpoint(
    endpoint: Optional[str] = typer.Argument(None, help="API endpoint to use")
):
    """
    Set the current endpoint

    Use this command to switch between different API endpoints.\n
    Standard endpoints are:\n
    - http://localhost:3000\n
    - https://api.datasets.leggedrobotics.com\n
    - https://api.datasets.dev.leggedrobotics.com
    """
    tokenfile = TokenFile()
    tokenfile.endpoint = endpoint
    tokenfile.writeToFile()
    print("Endpoint set to: " + endpoint)
    if tokenfile.endpoint not in tokenfile.tokens:
        print("No tokens found for this endpoint.")


def endpoint():
    """
    Get the current endpoint

    Also displays all endpoints with saved tokens.
    """
    tokenfile = TokenFile()
    print("Current: " + tokenfile.endpoint)
    print("Saved Tokens found for:")
    for _endpoint, _ in tokenfile.tokens.items():
        print("- " + _endpoint)


def setCliKey(key: Annotated[str, typer.Argument(help="CLI Key")]):
    """
    Set the CLI key (Actions Only)

    Same as login with the --key option.
    Should never be used by the user, only in docker containers launched from within Kleinkram.
    """
    tokenfile = TokenFile()
    if not tokenfile.endpoint in tokenfile.tokens:
        tokenfile.tokens[tokenfile.endpoint] = {}
    tokenfile.tokens[tokenfile.endpoint][CLI_KEY] = key
    tokenfile.writeToFile()
