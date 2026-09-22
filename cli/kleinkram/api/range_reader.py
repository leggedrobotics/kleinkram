from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from typing import Callable
from typing import List
from typing import Optional
from typing import Tuple

import httpx

logger = logging.getLogger(__name__)


# Reads inside an MCAP chunk are tiny and numerous (thousands per file), so the
# reader must never map one read onto one request. Blocks are fetched whole and
# cached; the small reads then hit memory.
DEFAULT_BLOCK_SIZE = 1024 * 1024
DEFAULT_MAX_CACHED_BLOCKS = 32

# Range requests against object storage are latency-bound: a selective read
# issues thousands of small requests, and serialising them means the round
# trips dominate. Eight in flight is enough to hide that without looking like
# a burst of abuse to the storage backend.
DEFAULT_CONCURRENCY = 8

RANGE_READ_TIMEOUT = 60.0


class RangeRequestsUnsupported(RuntimeError):
    """The server ignored a Range header and returned the whole object."""


class HttpRangeReader:
    """A seekable, read-only binary stream backed by HTTP range requests.

    Presigned storage URLs serve ranges, which lets an indexed reader touch only
    the parts of a remote file it actually needs. Reads are served from an
    LRU cache of fixed-size blocks; a read spanning several uncached blocks is
    fetched as a single request rather than one per block.

    Only the subset of the file protocol that `mcap.reader.SeekingReader` uses is
    implemented: `read`, `seek`, `tell`, `seekable`, `readable`, `close`.
    """

    def __init__(
        self,
        url: str,
        *,
        client: Optional[httpx.Client] = None,
        block_size: int = DEFAULT_BLOCK_SIZE,
        max_cached_blocks: int = DEFAULT_MAX_CACHED_BLOCKS,
    ) -> None:
        if block_size <= 0:
            raise ValueError("block_size must be positive")

        self._url = url
        self._block_size = block_size
        self._max_cached_blocks = max_cached_blocks
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=RANGE_READ_TIMEOUT, follow_redirects=True)
        self._blocks: "OrderedDict[int, bytes]" = OrderedDict()
        self._pos = 0
        self._bytes_fetched = 0
        self._requests = 0
        # `read_exact` is called from several threads at once; the counters and
        # the block cache are the only shared mutable state.
        self._lock = threading.Lock()
        # Called with the byte count of every completed request, from whichever
        # thread made it; used for progress reporting.
        self.on_fetch: Optional[Callable[[int], None]] = None
        self._size = self._probe_size()

    @property
    def size(self) -> int:
        return self._size

    @property
    def bytes_fetched(self) -> int:
        """Bytes actually pulled over the wire, as opposed to bytes read."""
        return self._bytes_fetched

    @property
    def requests(self) -> int:
        return self._requests

    def _probe_size(self) -> int:
        """Learn the object size from a one byte range request.

        Presigned storage URLs are signed for GET only, so HEAD is rejected. A
        single byte range reports the full size in Content-Range, and doubles as
        a check that the server honours ranges at all -- better to find out here
        than after the destination file has been opened.
        """
        with self._client.stream("GET", self._url, headers={"Range": "bytes=0-0"}) as response:
            response.raise_for_status()
            content_range = response.headers.get("content-range")
            if response.status_code != 206 or content_range is None or "/" not in content_range:
                # Deliberately not reading the body: a server that ignores the
                # range is about to send the whole object.
                raise RangeRequestsUnsupported(
                    f"{self._redacted_url} answered a range request with status "
                    f"{response.status_code}; partial download is not possible against this storage backend"
                )
            response.read()
        return int(content_range.rsplit("/", 1)[1])

    @property
    def _redacted_url(self) -> str:
        # The query string carries the presigned credentials.
        return self._url.split("?")[0]

    def _fetch(self, start: int, length: int) -> bytes:
        """Fetch [start, start+length) in one request."""
        end = min(start + length, self._size) - 1
        if end < start:
            return b""

        with self._client.stream("GET", self._url, headers={"Range": f"bytes={start}-{end}"}) as response:
            response.raise_for_status()

            # 200 means the range was ignored and the whole object is coming
            # back; stop before downloading it.
            if response.status_code != 206:
                raise RangeRequestsUnsupported(
                    f"{self._redacted_url} answered a range request with "
                    f"status {response.status_code}; expected 206 Partial Content"
                )
            # A proxy answering with a different interval would otherwise shift
            # every offset derived from this read.
            served = response.headers.get("content-range", "")
            if not served.startswith(f"bytes {start}-{end}/"):
                raise IOError(f"asked for bytes {start}-{end} but the server sent {served or 'no Content-Range'}")
            data = response.read()

        expected = end - start + 1
        if len(data) != expected:
            raise IOError(f"range request for bytes {start}-{end} returned {len(data)} bytes, expected {expected}")

        with self._lock:
            self._bytes_fetched += len(data)
            self._requests += 1
        if self.on_fetch is not None:
            self.on_fetch(len(data))
        return data

    def _cache_block(self, index: int, data: bytes) -> None:
        self._blocks[index] = data
        self._blocks.move_to_end(index)
        while len(self._blocks) > self._max_cached_blocks:
            self._blocks.popitem(last=False)

    def _missing_runs(self, first: int, last: int) -> List[Tuple[int, int]]:
        """Group the uncached block indices in [first, last] into contiguous runs."""
        runs: List[Tuple[int, int]] = []
        run_start: Optional[int] = None
        for index in range(first, last + 1):
            if index in self._blocks:
                if run_start is not None:
                    runs.append((run_start, index - 1))
                    run_start = None
            elif run_start is None:
                run_start = index
        if run_start is not None:
            runs.append((run_start, last))
        return runs

    def _ensure_cached(self, first: int, last: int) -> None:
        for run_first, run_last in self._missing_runs(first, last):
            start = run_first * self._block_size
            length = (run_last - run_first + 1) * self._block_size
            data = self._fetch(start, length)

            # Split the run back into block-sized pieces so the cache stays uniform.
            for offset in range(0, len(data), self._block_size):
                block_end = offset + self._block_size
                self._cache_block(run_first + offset // self._block_size, data[offset:block_end])

    def read_exact(self, offset: int, length: int) -> bytes:
        """Fetch exactly [offset, offset+length) without block alignment or caching.

        The block cache is tuned for streaming reads. Index structures are tiny
        and scattered across the whole file, so aligning them to blocks would
        pull a megabyte to read a few kilobytes, hundreds of times over.
        """
        if length <= 0:
            return b""
        return self._fetch(offset, length)

    def read(self, n: int = -1) -> bytes:
        if n is None or n < 0:
            n = self._size - self._pos
        n = min(n, max(self._size - self._pos, 0))
        if n <= 0:
            return b""

        first = self._pos // self._block_size
        last = (self._pos + n - 1) // self._block_size
        self._ensure_cached(first, last)

        out = bytearray()
        remaining = n
        while remaining > 0:
            index = self._pos // self._block_size
            block = self._blocks.get(index)
            if block is None:  # pragma: no cover - evicted mid-read, refetch
                self._ensure_cached(index, index)
                block = self._blocks[index]
            self._blocks.move_to_end(index)

            offset = self._pos - index * self._block_size
            take = min(remaining, len(block) - offset)
            if take <= 0:
                break
            take_end = offset + take
            out += block[offset:take_end]
            self._pos += take
            remaining -= take

        return bytes(out)

    def seek(self, offset: int, whence: int = 0) -> int:
        if whence == 0:
            new_pos = offset
        elif whence == 1:
            new_pos = self._pos + offset
        elif whence == 2:
            new_pos = self._size + offset
        else:
            raise ValueError(f"invalid whence: {whence}")
        self._pos = max(0, new_pos)
        return self._pos

    def tell(self) -> int:
        return self._pos

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def writable(self) -> bool:
        return False

    def close(self) -> None:
        self._blocks.clear()
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "HttpRangeReader":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
