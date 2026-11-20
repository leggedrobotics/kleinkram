from __future__ import annotations

from pathlib import Path

from kleinkram.utils import load_metadata


def test_unquoted_yaml_timestamps_are_sent_as_iso(tmp_path: Path) -> None:
    # YAML reads these as date/datetime objects; the server expects ISO 8601
    metadata = tmp_path / "metadata.yaml"
    metadata.write_text(
        "recorded: 2024-05-13T10:30:00Z\n"
        "local: 2024-05-13 10:30:00\n"
        "day: 2024-05-13\n"
        "speed: 1.5\n"
        "outdoor: true\n"
        "robot: anymal-d\n"
    )

    assert load_metadata(metadata) == {
        "recorded": "2024-05-13T10:30:00+00:00",
        "local": "2024-05-13T10:30:00",
        "day": "2024-05-13",
        "speed": "1.5",
        "outdoor": "True",
        "robot": "anymal-d",
    }


def test_quoted_values_are_sent_unchanged(tmp_path: Path) -> None:
    metadata = tmp_path / "metadata.yaml"
    metadata.write_text('recorded: "2024-05-13 10:30:00+00:00"\n')

    assert load_metadata(metadata) == {"recorded": "2024-05-13 10:30:00+00:00"}
