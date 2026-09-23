"""\
lookups that are meant to identify a single entity must never pick one of
several matches, since their result is what commands like `delete` act on
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import kleinkram.api.routes
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.api.query import file_query_is_unique
from kleinkram.errors import FileNotFound
from kleinkram.errors import InvalidFileQuery
from kleinkram.errors import InvalidMissionQuery
from kleinkram.errors import MissionNotFound

MISSION_QUERY = MissionQuery(patterns=["run1"], project_query=ProjectQuery(patterns=["robot"]))


def _missions(*names):
    return [SimpleNamespace(id=uuid4(), name=name) for name in names]


def test_get_mission_matches_the_project_name_exactly(monkeypatch):
    calls = []

    def get_missions(_client, _query, exact_match=False):
        calls.append(exact_match)
        return iter(_missions("run1"))

    monkeypatch.setattr(kleinkram.api.routes, "get_missions", get_missions)

    kleinkram.api.routes.get_mission(None, MISSION_QUERY)

    assert calls == [True]


def test_get_mission_refuses_to_pick_one_of_several(monkeypatch):
    monkeypatch.setattr(kleinkram.api.routes, "get_missions", lambda *_, **__: iter(_missions("run1", "run1")))

    with pytest.raises(InvalidMissionQuery, match="more than one"):
        kleinkram.api.routes.get_mission(None, MISSION_QUERY)


def test_get_mission_not_found(monkeypatch):
    monkeypatch.setattr(kleinkram.api.routes, "get_missions", lambda *_, **__: iter([]))

    with pytest.raises(MissionNotFound):
        kleinkram.api.routes.get_mission(None, MISSION_QUERY)


def test_get_file_refuses_to_pick_one_of_several(monkeypatch):
    files = [SimpleNamespace(id=uuid4(), name="a.bag"), SimpleNamespace(id=uuid4(), name="a.bag")]
    monkeypatch.setattr(kleinkram.api.routes, "get_files", lambda *_, **__: iter(files))
    query = FileQuery(patterns=["a.bag"], mission_query=MISSION_QUERY)

    with pytest.raises(InvalidFileQuery, match="more than one"):
        kleinkram.api.routes.get_file(None, query)


def test_get_file_not_found(monkeypatch):
    monkeypatch.setattr(kleinkram.api.routes, "get_files", lambda *_, **__: iter([]))
    query = FileQuery(patterns=["a.bag"], mission_query=MISSION_QUERY)

    with pytest.raises(FileNotFound):
        kleinkram.api.routes.get_file(None, query)


@pytest.mark.parametrize("name", ["", " ", "*", "*.bag", "a?.bag", "[ab].bag"])
def test_blank_and_wildcard_names_do_not_identify_a_file(name):
    assert not file_query_is_unique(FileQuery(patterns=[name], mission_query=MISSION_QUERY))
