from __future__ import annotations

from typing import Any
from typing import Dict
from typing import Generator
from typing import List
from typing import Mapping
from typing import Optional
from typing import cast

from kleinkram.api.client import AuthenticatedClient

DataPage = Dict[str, Any]


PAGE_SIZE = 128
SKIP = "skip"
TAKE = "take"
EXACT_MATCH = "exactMatch"


def paginated_request(
    client: AuthenticatedClient,
    endpoint: str,
    params: Optional[Mapping[str, Any]] = None,
    max_entries: Optional[int] = None,
    page_size: int = PAGE_SIZE,
    exact_match: bool = False,
) -> Generator[DataPage, None, None]:
    total_entries_count = 0

    params = dict(params or {})

    params[TAKE] = page_size
    params[SKIP] = 0
    if exact_match:
        params[EXACT_MATCH] = str(exact_match).lower()  # pass string rather than bool

    while True:
        resp = client.get(endpoint, params=params)

        # explicitly handle 404 if json contains message
        if resp.status_code == 404 and "message" in resp.json():
            raise ValueError(resp.json()["message"])

        # raise for other errors
        resp.raise_for_status()

        paged_data = resp.json()
        data_page = cast(List[DataPage], paged_data["data"])

        for entry in data_page:
            total_entries_count += 1
            yield entry
            if max_entries is not None and max_entries <= total_entries_count:
                return

        count = cast(int, paged_data["count"])
        skip = cast(int, paged_data["skip"])
        take = cast(int, paged_data["take"])

        if count - skip - take <= 0:
            return

        params[SKIP] = total_entries_count
