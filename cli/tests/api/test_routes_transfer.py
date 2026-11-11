from __future__ import annotations

from unittest.mock import MagicMock
from uuid import uuid4

from kleinkram.api.routes import _copy_files
from kleinkram.api.routes import _move_files

FILE_A = uuid4()
FILE_B = uuid4()
MISSION = uuid4()


def test_move_files_sends_files_target_and_renames():
    client = MagicMock()

    _move_files(client, [FILE_A, FILE_B], MISSION, {FILE_B: "b_1.bag"})

    client.patch.assert_called_once_with(
        "/files",
        json={
            "fileUUIDs": [str(FILE_A), str(FILE_B)],
            "missionUUID": str(MISSION),
            "renames": {str(FILE_B): "b_1.bag"},
        },
    )
    client.patch.return_value.raise_for_status.assert_called_once()


def test_copy_files_returns_the_ids_of_the_copies():
    copy_id = uuid4()
    client = MagicMock()
    client.post.return_value.json.return_value = {"fileUUIDs": [str(copy_id)]}

    copies = _copy_files(client, [FILE_A], MISSION, {})

    assert copies == [copy_id]
    client.post.assert_called_once_with(
        "/files/copy",
        json={"fileUUIDs": [str(FILE_A)], "missionUUID": str(MISSION), "renames": {}},
    )
