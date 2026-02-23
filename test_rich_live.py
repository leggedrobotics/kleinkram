from rich.live import Live
from rich.console import Group
from rich.text import Text
from rich.spinner import Spinner
from rich.table import Table
import time


def generate_layout(done=False):
    t = Table.grid(padding=(0, 1))
    t.add_column()
    t.add_column()

    if done:
        t.add_row(Text("[✔]", style="green"), Text("Running Action 123 0:01:00 (DONE)", style="bold"))
    else:
        t.add_row(Spinner("dots", style="blue"), Text("Running Action 123 0:00:59 (PROCESSING)", style="bold"))

    logs = Text(" => [2026-02-23] [STDOUT] hello world\n => [2026-02-23] [STDOUT] this is a test")

    return Group(t, logs)


with Live(generate_layout(), refresh_per_second=10) as live:
    time.sleep(1)
    live.update(generate_layout(done=True))
    time.sleep(1)
