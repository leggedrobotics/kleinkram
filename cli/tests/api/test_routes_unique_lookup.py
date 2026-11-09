"""\
deleting resolves its target with a strict lookup: names must match exactly
(no substring match on the project), blank names identify nothing and a
lookup matching several entities fails instead of picking the first one
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

import pytest

import kleinkram.api.routes
from kleinkram.api.query import FileQuery
from kleinkram.api.query import MissionQuery
from kleinkram.api.query import ProjectQuery
from kleinkram.errors import FileNotFound
from kleinkram.errors import InvalidFileQuery
from kleinkram.errors import InvalidMissionQuery
from kleinkram.errors import InvalidProjectQuery

MISSION_QUERY = MissionQuery(patterns=["run1"], project_query=ProjectQuery(patterns=["robot"]))
FILE_QUERY = FileQuery(patterns=["a.bag"], mission_query=MISSION_QUERY)


def _entities(count):
    return [SimpleNamespace(id=uuid4(), name="x") for _ in range(count)]


@pytest.fixture
def listed(monkeypatch):
    """replace the list routes, record whether they were asked for exact matches"""
    calls = []
    results = {"count": 1}

    def fake(_client, _query, exact_match=False, **_):
        calls.append(exact_match)
        return iter(_entities(results["count"]))

    for name in ("get_projects", "get_missions", "get_files"):
        monkeypatch.setattr(kleinkram.api.routes, name, fake)
    monkeypatch.setattr(kleinkram.api.routes, "get_file_by_id", lambda _client, file_id: file_id)
    return SimpleNamespace(calls=calls, results=results)


def test_strict_lookups_match_names_exactly(listed):
    kleinkram.api.routes.get_project(None, ProjectQuery(patterns=["robot"]), strict=True)
    kleinkram.api.routes.get_mission(None, MISSION_QUERY, strict=True)
    kleinkram.api.routes.get_file(None, FILE_QUERY, strict=True)

    assert listed.calls == [True, True, True]


@pytest.mark.parametrize(
    "lookup, error",
    [
        (lambda: kleinkram.api.routes.get_project(None, ProjectQuery(patterns=["robot"]), strict=True), InvalidProjectQuery),
        (lambda: kleinkram.api.routes.get_mission(None, MISSION_QUERY, strict=True), InvalidMissionQuery),
        (lambda: kleinkram.api.routes.get_file(None, FILE_QUERY, strict=True), InvalidFileQuery),
    ],
)
def test_strict_lookups_refuse_to_pick_one_of_several(listed, lookup, error):
    listed.results["count"] = 2

    with pytest.raises(error, match="more than one"):
        lookup()


def test_strict_lookup_not_found(listed):
    listed.results["count"] = 0

    with pytest.raises(FileNotFound):
        kleinkram.api.routes.get_file(None, FILE_QUERY, strict=True)


@pytest.mark.parametrize(
    "query",
    [
        FileQuery(patterns=[""], mission_query=MISSION_QUERY),
        FileQuery(patterns=["a.bag"], mission_query=MissionQuery(patterns=[" "], project_query=ProjectQuery(patterns=["p"]))),
        FileQuery(
            patterns=["a.bag"], mission_query=MissionQuery(patterns=["run1"], project_query=ProjectQuery(patterns=[""]))
        ),
    ],
)
def test_strict_lookups_reject_blank_names_before_querying(listed, query):
    with pytest.raises(InvalidFileQuery):
        kleinkram.api.routes.get_file(None, query, strict=True)

    assert listed.calls == []


@pytest.mark.parametrize("name", ["*", "*.bag", "a?.bag", "[ab].bag"])
def test_wildcards_never_identify_a_single_file(listed, name):
    with pytest.raises(InvalidFileQuery):
        kleinkram.api.routes.get_file(None, FileQuery(patterns=[name], mission_query=MISSION_QUERY), strict=True)

    assert listed.calls == []


def test_non_strict_lookups_keep_their_lenient_behaviour(listed):
    listed.results["count"] = 2

    kleinkram.api.routes.get_mission(None, MISSION_QUERY)
    kleinkram.api.routes.get_file(None, FILE_QUERY)

    assert listed.calls == [False, False]
