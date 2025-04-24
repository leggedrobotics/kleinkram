<template>
    <div style="margin-top: 32px">
        <span class="text-h5">Define the Action</span>

        <div class="text-caption q-mt-sm">
            {{
                selectedMissions?.data.map((mission) => mission.name).join(', ')
            }}
        </div>

        <ErrorMessage :errors="errors" field-path="missionUuids" />
    </div>
</template>

<script setup lang="ts">
import ErrorMessage from 'components/action-submission/settings/error-message.vue';
import { ActionConfigurationValidationError } from 'components/action-submission/types';
import { useHandler, useManyMissions } from 'src/hooks/query-hooks';
import { defineModel, watch } from 'vue';

const missionUuids = defineModel<string[]>('missionUuids', { required: true });
const { data: selectedMissions } = useManyMissions(missionUuids);

const errors = defineModel<ActionConfigurationValidationError[]>('errors', {
    required: true,
});
const handler = useHandler();

watch(
    () => handler,
    (_handler) => {
        console.log(_handler.value.missionUuid);

        missionUuids.value = _handler.value.missionUuid
            ? [_handler.value.missionUuid]
            : [];
    },
    { immediate: true, deep: true },
);

watch(
    () => missionUuids.value,
    (uuids) => {
        const newErrors = errors.value.filter(
            (error) => error.fieldPath !== 'missionUuids',
        );

        if (uuids.length === 0) {
            newErrors.push({
                fieldPath: 'missionUuids',
                errorMessage: 'Please select at least one mission.',
            });
        }

        errors.value = newErrors;
    },
    {},
);
</script>
