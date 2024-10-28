import typer

from kleinkram.auth.auth import TokenFile

endpoint = typer.Typer(
    name="endpoint",
    help="Get Or Set the current endpoint.\n\nThe endpoint is used to determine the API server to connect to"
    "(default is the API server of https://datasets.leggedrobotics.com).",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@endpoint.command("set")
def set_endpoint(endpoint: str = typer.Argument(None, help="API endpoint to use")):
    """
    Set the current endpoint

    Use this command to switch between different API endpoints.\n
    Standard endpoints are:\n
    - http://localhost:3000\n
    - https://api.datasets.leggedrobotics.com\n
    - https://api.datasets.dev.leggedrobotics.com
    """

    if not endpoint:
        raise ValueError("No endpoint provided.")

    tokenfile = TokenFile()
    tokenfile.endpoint = endpoint
    tokenfile.writeToFile()

    print()
    print("Endpoint set to: " + endpoint)
    if tokenfile.endpoint not in tokenfile.tokens:
        print(
            "Not authenticated on this endpoint, please execute 'klein login' to authenticate."
        )


@endpoint.command("get")
def get_endpoints():
    """
    Get the current endpoint

    Also displays all endpoints with saved tokens.
    """
    tokenfile = TokenFile()
    print("Current: " + tokenfile.endpoint)
    print()

    if not tokenfile.tokens:
        print("No saved tokens found.")
        return

    print("Saved Tokens found for:")
    for _endpoint, _ in tokenfile.tokens.items():
        print("- " + _endpoint)
