from __future__ import annotations

from datetime import datetime
from pathlib import Path
from argparse import ArgumentParser
import configparser


VERSION_FILE_PATH = Path() / "cli" / "kleinkram" / "_version.py"
CFG_FILE_PATH = Path() / "cli" / "setup.cfg"

VERSION_FILE = """\
from __future__ import annotations

from importlib.metadata import version

__version__ = version("kleinkram")
__local__ = False
"""


def write_cfg_for_dev() -> None:
    config = configparser.ConfigParser()
    config.read(CFG_FILE_PATH)

    vers = config["metadata"]["version"]
    vers += f"-dev{datetime.now().strftime('%Y%m%d%H%M%S')}"

    config["metadata"]["version"] = vers

    with open(CFG_FILE_PATH, "w") as cfg_file:
        config.write(cfg_file)


def release(dev: bool) -> None:
    if dev:
        write_cfg_for_dev()

    with open(VERSION_FILE_PATH, "w") as version_file:
        version_file.write(VERSION_FILE)


def main() -> int:
    arg_parser = ArgumentParser()
    arg_parser.add_argument("--dev", action="store_true")

    args = arg_parser.parse_args()
    release(args.dev)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
