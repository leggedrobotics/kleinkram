from typing_extensions import Annotated

import httpx
import typer
from rich.table import Table

from kleinkram.api_client import AuthenticatedClient

topic = typer.Typer(
    name="topic",
    help="Topic operations",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)


@topic.command("list")
def topics(
    file: Annotated[str, typer.Option(help="Name of File")],
    full: Annotated[
        bool, typer.Option(help="As a table with additional parameters")
    ] = False,
    # Todo add mission / project as optional argument as filenames are not unique or handle multiple files
):
    """
    List topics for a file

    Only makes sense with MCAP files as we don't associate topics with BAGs as that would be redundant.
    """
    if file.endswith(".bag"):
        print("BAG files generally do not have topics")
    try:
        url = "/file/byName"
        client = AuthenticatedClient()
        response = client.get(url, params={"name": file})
        response.raise_for_status()
        data = response.json()
        if not full:
            for topic in data["topics"]:
                print(f" - {topic['name']}")
        else:
            table = Table("UUID", "name", "type", "nrMessages", "frequency")
            for topic in data["topics"]:
                table.add_row(
                    topic["uuid"],
                    topic["name"],
                    topic["type"],
                    topic["nrMessages"],
                    f"{topic['frequency']}",
                )
            print(table)

    except httpx.HTTPError as e:
        print(f"Failed")
        raise e
