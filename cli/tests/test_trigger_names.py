"""\
like the server, `update_trigger` checks the format of a trigger name only
when it changes: triggers named before the naming rules keep their name; the
name must still be unique in the mission the trigger ends up in (server mocked)
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

import kleinkram.core
import kleinkram.errors


@pytest.fixture
def routes(monkeypatch) -> MagicMock:
    routes = MagicMock()
    routes.get_trigger.return_value = SimpleNamespace(name="Legacy Trigger", mission_uuid=uuid4())
    routes.get_mission.side_effect = lambda client, query: SimpleNamespace(id=query.ids[0])
    routes.get_triggers.return_value = []
    monkeypatch.setattr(kleinkram.core.kleinkram.api, "routes", routes)
    return routes


def test_unchanged_legacy_name_is_kept(routes):
    kleinkram.core.update_trigger(MagicMock(), uuid4(), trigger_name="Legacy Trigger", description="new")
    assert routes._update_trigger.call_args.kwargs["name"] == "Legacy Trigger"


def test_changed_name_follows_the_rules(routes):
    with pytest.raises(kleinkram.errors.TriggerValidationError, match="may only contain"):
        kleinkram.core.update_trigger(MagicMock(), uuid4(), trigger_name="Other Name")
    routes._update_trigger.assert_not_called()

    kleinkram.core.update_trigger(MagicMock(), uuid4(), trigger_name="other-name")
    assert routes._update_trigger.call_args.kwargs["name"] == "other-name"


@pytest.mark.parametrize("trigger_name", ["Legacy Trigger", None])
def test_moving_to_a_mission_with_the_same_trigger_name_is_refused(routes, trigger_name):
    other_mission = uuid4()
    routes.get_triggers.return_value = [SimpleNamespace(name="Legacy Trigger", uuid=uuid4())]
    with pytest.raises(kleinkram.errors.TriggerValidationError, match="already exists in mission"):
        kleinkram.core.update_trigger(MagicMock(), uuid4(), trigger_name=trigger_name, mission_uuid=other_mission)
    routes._update_trigger.assert_not_called()


def test_moving_keeps_a_legacy_name_if_it_is_free(routes):
    other_mission = uuid4()
    kleinkram.core.update_trigger(MagicMock(), uuid4(), trigger_name="Legacy Trigger", mission_uuid=other_mission)
    kwargs = routes._update_trigger.call_args.kwargs
    assert (kwargs["name"], kwargs["mission_uuid"]) == ("Legacy Trigger", other_mission)
