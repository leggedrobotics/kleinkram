import typer

queue = typer.Typer(
    name="queue",
    help="Status of files uploading",
    no_args_is_help=True,
    context_settings={"help_option_names": ["-h", "--help"]},
)
