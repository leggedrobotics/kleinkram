from __future__ import annotations

from kleinkram.cli.app import app


def main() -> int:
    app()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
