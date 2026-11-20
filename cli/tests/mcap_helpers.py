"""MCAP fixtures shared by the partial download and inspect tests.

Writes small recordings, serves them over HTTP with Range support the way
object storage does, and stands in for the remote `File` records.
"""

from __future__ import annotations

import random
import re
import threading
from contextlib import contextmanager
from datetime import datetime
from datetime import timezone
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer
from pathlib import Path
from typing import List
from typing import Optional
from typing import Tuple
from uuid import uuid4

import pytest

from kleinkram.models import File
from kleinkram.models import FileState

mcap_writer = pytest.importorskip("mcap.writer")

TOPICS = ("/tf", "/odom", "/camera")
PAYLOAD_SIZES = {"/tf": 64, "/odom": 128, "/camera": 4096}
MESSAGES_PER_TOPIC = 400
INTERVAL_NS = 10_000_000  # 100 Hz


def payload(topic: str, index: int) -> bytes:
    """Deterministic pseudo-random bytes, so two fixtures agree byte for byte."""
    return random.Random(f"{topic}:{index}").randbytes(PAYLOAD_SIZES[topic])


def write_mcap(path: Path, *, compression=None, **writer_kwargs) -> None:
    kwargs = dict(writer_kwargs)
    if compression is not None:
        kwargs["compression"] = compression
    with path.open("wb") as handle:
        writer = mcap_writer.Writer(handle, chunk_size=64 * 1024, **kwargs)
        writer.start(profile="ros2", library="test")
        schema_id = writer.register_schema(name="test/Dummy", encoding="jsonschema", data=b"{}")
        channels = {
            topic: writer.register_channel(topic=topic, message_encoding="cdr", schema_id=schema_id) for topic in TOPICS
        }
        for index in range(MESSAGES_PER_TOPIC):
            log_time = index * INTERVAL_NS
            for topic, channel_id in channels.items():
                writer.add_message(
                    channel_id=channel_id,
                    log_time=log_time,
                    data=payload(topic, index),
                    publish_time=log_time,
                )
        writer.finish()


class _RangeHandler(BaseHTTPRequestHandler):
    """Serves one file, honouring Range like S3 does.

    `fail_after` makes every range request after that many answer 500, to
    simulate storage failing half way through a download.
    """

    served_path: Path
    requests: List[Tuple[int, int]]
    honour_range = True
    fail_after: Optional[int] = None
    # Headers and body go out as separate writes; with Nagle on, each small
    # response then waits for a delayed ACK and the tests crawl.
    disable_nagle_algorithm = True
    # Keep-alive, as S3 does; a fresh connection per range dominates otherwise.
    protocol_version = "HTTP/1.1"

    def log_message(self, *args: object) -> None:
        pass

    def do_GET(self) -> None:
        size = self.served_path.stat().st_size
        header = self.headers.get("Range")

        if header is None or not self.honour_range:
            data = self.served_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if self.fail_after is not None and len(self.requests) >= self.fail_after:
            self.send_response(500)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

        match = re.match(r"bytes=(\d+)-(\d*)", header)
        assert match is not None
        start = int(match.group(1))
        end = int(match.group(2)) if match.group(2) else size - 1
        end = min(end, size - 1)
        self.requests.append((start, end))

        with self.served_path.open("rb") as handle:
            handle.seek(start)
            chunk = handle.read(end - start + 1)
        self.send_response(206)
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(len(chunk)))
        self.end_headers()
        self.wfile.write(chunk)


@contextmanager
def serve(path: Path, *, honour_range: bool = True, fail_after: Optional[int] = None):
    """Serve one file over HTTP; yields (url, requests) where requests logs each range."""
    requests: List[Tuple[int, int]] = []
    handler = type(
        "BoundHandler",
        (_RangeHandler,),
        {"served_path": path, "requests": requests, "honour_range": honour_range, "fail_after": fail_after},
    )
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}/{path.name}", requests
    finally:
        server.shutdown()
        server.server_close()


def remote_file(name: str, *, state: FileState = FileState.OK, size: int = 0) -> File:
    now = datetime.now(timezone.utc)
    return File(
        id=uuid4(),
        name=name,
        hash="not-a-real-hash",
        size=size,
        type_="MCAP",
        date=now,
        created_at=now,
        updated_at=now,
        mission_id=uuid4(),
        mission_name="mission",
        project_id=uuid4(),
        project_name="project",
        state=state,
    )


def plain(output: str) -> str:
    """CLI output without colour codes or the error panel's frame and wrapping.

    Rich colours its output on CI (and not locally), and wraps error panels.
    """
    output = re.sub(r"\x1b\[[0-9;]*m", "", output)
    output = re.sub(r"[│╭╮╰╯─]", " ", output)
    return " ".join(output.split())
