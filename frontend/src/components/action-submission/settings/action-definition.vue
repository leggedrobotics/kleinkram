<template>
    <div style="margin-top: 32px">
        <span class="text-h5">Define the Action</span>
        <div class="flex column" style="gap: 12px; margin-top: 16px">
            <div>
                <label for="dockerImage">Action Image *</label>
                <q-input
                    v-model="imageName"
                    name="dockerImage"
                    outlined
                    dense
                    clearable
                    debounce="300"
                    placeholder="Docker Image"
                    @clear="onInputClear"
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionDefinition.imageName"
                />
            </div>
            <div>
                <label for="action_trigger">Action Trigger *</label>
                <q-input
                    name="action_trigger"
                    :model-value="trigger"
                    readonly
                    outlined
                    dense
                    clearable
                    placeholder="Action Trigger"
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionDefinition.trigger"
                />
            </div>
            <div>
                <label for="action_command">Command</label>
                <q-input
                    v-model="command"
                    name="action_command"
                    outlined
                    dense
                    clearable
                    placeholder="Command"
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionDefinition.actionCommand"
                />
            </div>
            <div>
                <label for="action_entrypoint">Entrypoint</label>
                <q-input
                    v-model="entrypoint"
                    name="action_entrypoint"
                    outlined
                    dense
                    clearable
                    placeholder="Entrypoint"
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionDefinition.entrypoint"
                />
            </div>
            <div>
                <q-select
                    v-model="accessRights"
                    :options="accessOptions"
                    map-options
                    label="Select Access Rights *"
                />
                <ErrorMessage :errors="errors" field-path="accessRights" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { AccessGroupRights } from '@common/enum';
import ErrorMessage from 'components/action-submission/settings/error-message.vue';
import { ActionConfigurationValidationError } from 'components/action-submission/types';
import { accessGroupRightsMap } from 'src/services/generic';
import { defineModel, watch } from 'vue';

const imageName = defineModel<string>('imageName', { required: true });
const trigger = defineModel<string>('trigger', { required: true });
const command = defineModel<string>('command', { required: true });
const entrypoint = defineModel<string>('entrypoint', { required: true });
const accessRights = defineModel<{ label: string; value: AccessGroupRights }>(
    'accessRights',
    { required: true },
);
const errors = defineModel<ActionConfigurationValidationError[]>('errors', {
    required: true,
});

const accessOptions = Object.entries(accessGroupRightsMap)
    .filter(([k]) => Number(k) !== AccessGroupRights._ADMIN)
    .map(([_, v]) => ({ label: v, value: Number(_) }));

const onInputClear = (): void => {
    imageName.value = '';
};

watch(
    () => imageName.value,
    () => {
        const newErrors = errors.value.filter(
            (error) => error.fieldPath !== 'actionDefinition.imageName',
        );

        if (imageName.value.length === 0) {
            newErrors.push({
                fieldPath: 'actionDefinition.imageName',
                errorMessage: 'Please select a docker image.',
            });
        } else if (!imageName.value.startsWith('rslethz/')) {
            newErrors.push({
                fieldPath: 'actionDefinition.imageName',
                errorMessage: 'Docker image must start with rslethz/',
            });
        } else if (
            !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+:[a-zA-Z0-9_.-]+$/.test(
                imageName.value,
            )
        ) {
            newErrors.push({
                fieldPath: 'actionDefinition.imageName',
                errorMessage: `Docker image must be in the format <name>:<tag>`,
            });
        }

        errors.value = newErrors;
    },
);
</script>
