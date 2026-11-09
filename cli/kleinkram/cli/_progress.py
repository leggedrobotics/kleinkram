from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Callable
from typing import Dict
from typing import Iterator
from typing import NamedTuple
from typing import Optional
from typing import Tuple
from typing import TypeVar

from rich.console import Console
from rich.console import Group
from rich.live import Live
from rich.progress import BarColumn
from rich.progress import DownloadColumn
from rich.progress import MofNCompleteColumn
from rich.progress import Progress
from rich.progress import SpinnerColumn
from rich.progress import TaskID
from rich.progress import TextColumn
from rich.progress import TimeRemainingColumn
from rich.progress import TransferSpeedColumn

from kleinkram.api.file_transfer import OnFileProgressCb
from kleinkram.api.file_transfer import OnFileStartCb
from kleinkram.api.file_transfer import OnMessageCb
from kleinkram.api.file_transfer import OnOverallProgressCb
from kleinkram.errors import get_transfer_result

T = TypeVar("T")


def run_interruptible(transfer: Callable[[], T]) -> Tuple[T, bool]:
    """Run an upload or download; on Ctrl+C return its partial result instead of raising.

    The library re-raises Ctrl+C so scripts stop. The CLI still wants to
    print what finished, then exit with 130. A Ctrl+C without a result
    attached (e.g. while resolving the query) propagates as usual.
    """
    try:
        return transfer(), False
    except KeyboardInterrupt as e:
        result = get_transfer_result(e)
        if result is None:
            raise
        return result, True


class TransferCallbacks(NamedTuple):
    on_file_start: OnFileStartCb
    on_file_progress: OnFileProgressCb
    on_overall_progress: OnOverallProgressCb
    on_message: OnMessageCb


@contextmanager
def transfer_progress(description: str, total: Optional[int] = None) -> Iterator[TransferCallbacks]:
    """Context manager that sets up rich progress bars for file transfers.

    Args:
        description: Label for the overall progress bar (e.g. "Downloading files").
        total: Total number of files. Pass None for indeterminate progress.

    Yields:
        TransferCallbacks with on_file_start, on_file_progress, on_overall_progress, on_message.
    """
    stderr_console = Console(stderr=True)
    overall_progress = Progress(
        SpinnerColumn(),
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        MofNCompleteColumn(),
        TimeRemainingColumn(),
        console=stderr_console,
    )
    file_progress = Progress(
        TextColumn("[bold blue]{task.description}"),
        BarColumn(),
        DownloadColumn(),
        TransferSpeedColumn(),
        TimeRemainingColumn(),
        console=stderr_console,
    )
    progress_group = Group(overall_progress, file_progress)

    file_tasks: Dict[Path, TaskID] = {}
    overall_task = overall_progress.add_task(description, total=total)

    def on_file_start(path: Path, total_bytes: int) -> None:
        if path in file_tasks:
            file_progress.update(file_tasks[path], completed=0, total=total_bytes)
        else:
            file_tasks[path] = file_progress.add_task(path.name, total=total_bytes)

    def on_file_progress(path: Path, advance: int) -> None:
        if path in file_tasks:
            file_progress.update(file_tasks[path], advance=advance)

    def on_overall_progress() -> None:
        overall_progress.update(overall_task, advance=1)

    def on_message(msg: str, is_error: bool) -> None:
        style = "red" if is_error else "yellow"
        file_progress.console.print(f"[{style}]{msg}[/{style}]")

    with Live(progress_group, console=stderr_console):
        yield TransferCallbacks(on_file_start, on_file_progress, on_overall_progress, on_message)
