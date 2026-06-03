from __future__ import annotations

from secrets import token_hex
from uuid import uuid4

import pytest

import kleinkram.core
import kleinkram.errors
from kleinkram.models import (
    FileConfig,
    FileTriggerEvent,
    TimeConfig,
    TriggerType,
    WebhookConfig,
)
from kleinkram.wrappers import (
    create_trigger,
    delete_trigger,
    list_triggers,
    update_trigger,
)


@pytest.mark.slow
def test_trigger_crud_file(empty_mission, action_template):
    trigger_name = f"trig-{token_hex(6)}"
    config = FileConfig(
        patterns=("*.bag", "data/*.csv"),
        event=(FileTriggerEvent.UPLOAD, FileTriggerEvent.DELETE),
    )

    # 1. Create
    trigger_uuid = create_trigger(
        trigger_name=trigger_name,
        description="Test FILE trigger",
        template_uuid=action_template.uuid,
        mission_uuid=empty_mission.id,
        type_=TriggerType.FILE,
        config=config,
    )
    assert trigger_uuid is not None

    # 2. List & Verify Details
    triggers = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers) == 1
    trigger = triggers[0]
    assert trigger.uuid == trigger_uuid
    assert trigger.name == trigger_name
    assert trigger.description == "Test FILE trigger"
    assert trigger.type == TriggerType.FILE
    print(trigger.config)
    assert trigger.config.patterns == ("*.bag", "data/*.csv")
    assert trigger.config.event == (FileTriggerEvent.UPLOAD, FileTriggerEvent.DELETE)

    # 3. Update
    new_name = f"trig-upd-{token_hex(4)}"
    new_config = FileConfig(patterns=("*.bin",), event=(FileTriggerEvent.UPLOAD,))
    update_trigger(
        trigger_uuid=trigger_uuid,
        trigger_name=new_name,
        description="Updated description",
        type_=TriggerType.FILE,
        config=new_config,
    )

    # Verify Updates
    triggers_updated = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers_updated) == 1
    updated = triggers_updated[0]
    assert updated.name == new_name
    assert updated.description == "Updated description"
    assert updated.config.patterns == ("*.bin",)

    # 4. Delete
    delete_trigger(trigger_uuid)
    assert len(list_triggers(mission_uuid=empty_mission.id)) == 0


@pytest.mark.slow
def test_trigger_crud_time(empty_mission, action_template):
    trigger_name = f"trig-{token_hex(6)}"
    config = TimeConfig(cron="*/5 * * * *")

    # 1. Create
    trigger_uuid = create_trigger(
        trigger_name=trigger_name,
        template_uuid=action_template.uuid,
        mission_uuid=empty_mission.id,
        type_=TriggerType.TIME,
        config=config,
    )

    # 2. List & Verify Details
    triggers = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers) == 1
    assert triggers[0].type == TriggerType.TIME
    assert triggers[0].config.cron == "*/5 * * * *"

    # 3. Update
    new_name = f"trig-time-upd-{token_hex(4)}"
    new_config = TimeConfig(cron="0 0 * * *")
    update_trigger(
        trigger_uuid=trigger_uuid,
        trigger_name=new_name,
        description="Updated time trigger desc",
        type_=TriggerType.TIME,
        config=new_config,
    )

    # Verify Updates
    triggers_updated = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers_updated) == 1
    updated = triggers_updated[0]
    assert updated.name == new_name
    assert updated.description == "Updated time trigger desc"
    assert updated.config.cron == "0 0 * * *"

    # 4. Delete
    delete_trigger(trigger_uuid)
    assert len(list_triggers(mission_uuid=empty_mission.id)) == 0


@pytest.mark.slow
def test_trigger_crud_webhook(empty_mission, action_template):
    trigger_name = f"trig-{token_hex(6)}"
    config = WebhookConfig()

    # 1. Create
    trigger_uuid = create_trigger(
        trigger_name=trigger_name,
        template_uuid=action_template.uuid,
        mission_uuid=empty_mission.id,
        type_=TriggerType.WEBHOOK,
        config=config,
    )

    # 2. List & Verify Details
    triggers = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers) == 1
    assert triggers[0].type == TriggerType.WEBHOOK

    # 3. Update
    new_name = f"trig-web-upd-{token_hex(4)}"
    update_trigger(
        trigger_uuid=trigger_uuid,
        trigger_name=new_name,
        description="Updated webhook trigger desc",
        type_=TriggerType.WEBHOOK,
        config=WebhookConfig(),
    )

    # Verify Updates
    triggers_updated = list_triggers(mission_uuid=empty_mission.id)
    assert len(triggers_updated) == 1
    updated = triggers_updated[0]
    assert updated.name == new_name
    assert updated.description == "Updated webhook trigger desc"

    # 4. Delete
    delete_trigger(trigger_uuid)
    assert len(list_triggers(mission_uuid=empty_mission.id)) == 0


@pytest.mark.slow
@pytest.mark.parametrize(
    "invalid_name",
    [
        "ab",  # Too short (< 3 chars)
        "this-trigger-name-is-way-too-long-to-be-allowed-by-validation-regex-fifty-chars",  # Too long (> 50 chars)
        "trigger name with spaces",  # Invalid characters
        "trigger_name_trailing ",  # Trailing whitespace
    ],
)
def test_trigger_validation_invalid_name(empty_mission, action_template, invalid_name):
    config = WebhookConfig()
    
    with pytest.raises(kleinkram.errors.TriggerValidationError):
        create_trigger(
            trigger_name=invalid_name,
            template_uuid=action_template.uuid,
            mission_uuid=empty_mission.id,
            type_=TriggerType.WEBHOOK,
            config=config,
        )


@pytest.mark.slow
def test_trigger_validation_duplicate_name(empty_mission, action_template):
    trigger_name = f"trig-{token_hex(6)}"
    config = WebhookConfig()

    # Create first trigger
    trig_uuid1 = create_trigger(
        trigger_name=trigger_name,
        template_uuid=action_template.uuid,
        mission_uuid=empty_mission.id,
        type_=TriggerType.WEBHOOK,
        config=config,
    )

    # Attempt to create second trigger with same name
    with pytest.raises(kleinkram.errors.TriggerValidationError):
        create_trigger(
            trigger_name=trigger_name,
            template_uuid=action_template.uuid,
            mission_uuid=empty_mission.id,
            type_=TriggerType.WEBHOOK,
            config=config,
        )

    delete_trigger(trig_uuid1)


@pytest.mark.slow
def test_trigger_validation_invalid_entities(empty_mission, action_template):
    # Non-existent template UUID
    with pytest.raises(kleinkram.errors.TriggerValidationError):
        create_trigger(
            trigger_name="valid-name",
            template_uuid=uuid4(),
            mission_uuid=empty_mission.id,
            type_=TriggerType.WEBHOOK,
            config=WebhookConfig(),
        )

    # Non-existent mission UUID
    with pytest.raises(kleinkram.errors.TriggerValidationError):
        create_trigger(
            trigger_name="valid-name",
            template_uuid=action_template.uuid,
            mission_uuid=uuid4(),
            type_=TriggerType.WEBHOOK,
            config=WebhookConfig(),
        )


@pytest.mark.slow
def test_trigger_validation_mismatched_config(empty_mission, action_template):
    # FILE trigger type with TimeConfig
    with pytest.raises(kleinkram.errors.TriggerValidationError):
        create_trigger(
            trigger_name="test-mismatch",
            template_uuid=action_template.uuid,
            mission_uuid=empty_mission.id,
            type_=TriggerType.FILE,
            config=TimeConfig(cron="* * * * *"),
        )