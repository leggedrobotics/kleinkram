from __future__ import annotations
from pathlib import Path
import typer
from typing import Optional, List
from kleinkram.models import print_files
from kleinkram.utils import get_version
from kleinkram.auth import login_flow
from kleinkram.config import Config, get_shared_state
from kleinkram.api.client import AuthenticatedClient
from kleinkram.api.routes import claim_admin
from kleinkram.commands.project import project
from kleinkram.commands.mission import mission
from kleinkram.commands.file import file
from kleinkram.commands.endpoint import endpoint
from kleinkram.commands import download as new_download
from kleinkram.file_transfer import download_file
from kleinkram.api.routes import get_files, get_file
from uuid import UUID
from kleinkram.file_transfer import download_file

CLI_HELP = """\
Kleinkram CLI

The Kleinkram CLI is a command line interface for Kleinkram.
For a list of available commands, run `klein --help` or visit \
https://docs.datasets.leggedrobotics.com/usage/cli/cli-getting-started.html \
for more information.
"""

app = typer.Typer(
    context_settings={"help_option_names": ["-h", "--help"]},
    no_args_is_help=True,
    help=CLI_HELP,
)

app.add_typer(project, name="project")
app.add_typer(mission, name="mission")
app.add_typer(file, name="file")
app.add_typer(endpoint, name="endpoint")
app.add_typer(new_download.download, name="ndownload")


@app.command()
def login(
    key: Optional[str] = typer.Option(None, help="CLI key"),
    headless: bool = typer.Option(False),
) -> None:
    login_flow(key=key, headless=headless)


@app.command()
def logout(all: bool = typer.Option(False, help="logout on all enpoints")) -> None:
    config = Config()
    config.clear_credentials(all=all)


@app.command(hidden=True)
def claim():
    client = AuthenticatedClient()
    claim_admin(client)
    print("Admin rights claimed successfully.")


@app.command()
def upload():
    raise NotImplementedError


@app.command()
def download(
    id: List[str] = typer.Option(default_factory=list, help="UUIDs of the files"),
    name: List[str] = typer.Option(default_factory=list, help="names of the file"),
    project: Optional[str] = typer.Option(None, help="project name"),
    mission: Optional[str] = typer.Option(None, help="mission name"),
    topics: List[str] = typer.Option(default_factory=list, help="topics"),
    tags: List[str] = typer.Option(default_factory=list, help="tag=value pairs"),
    dest: str = typer.Option(prompt=True, help="Local path to save the file"),
) -> None:
    client = AuthenticatedClient()

    # create destionation directory
    dest_dir = Path(dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    _tags = tags if tags else None
    _topics = topics if topics else None

    by_ids = len(id) > 0
    by_names = len(name) > 0
    by_query = any([project, mission, topics, tags])

    if by_ids + by_names + by_query != 1:
        raise ValueError("Please provide exactly one querying method")

    files = []
    if id:
        for file_id in id:
            try:
                parsed_id = UUID(file_id, version=4)
            except ValueError:
                print(f"Invalid UUID: {file_id}")
                continue

            file = get_file(client, parsed_id)
            files.append(file)

    elif name:
        for n in name:
            new = get_files(client, name=n)
            files.extend(new)

    elif project or mission or topics or tags:
        new = get_files(
            client, project=project, mission=mission, tags=_tags, topics=_topics
        )
        files.extend(new)

    # create destionation directory
    dest_dir = Path(dest)
    dest_dir.mkdir(parents=True, exist_ok=True)

    if get_shared_state().debug:
        print("found files:")
        print_files(files)

    for file in files:
        try:
            download_file(
                client,
                file_id=file.id,
                name=file.name,
                dest=dest_dir,
                hash=file.hash,
                size=file.size,
            )
        except Exception as e:
            print(f"Error downloading file {file.name}: {e}")


def _version_cb(value: bool) -> None:
    if value:
        typer.echo(get_version())
        raise typer.Exit()


@app.callback()
def cli(
    verbose: bool = typer.Option(True),
    version: Optional[bool] = typer.Option(None, "--version", callback=_version_cb),
    debug: bool = typer.Option(False),
):
    _ = version  # suppress unused variable warning
    shared_state = get_shared_state()
    shared_state.verbose = verbose
    shared_state.debug = debug
