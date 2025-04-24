<template>
    <div style="margin-top: 32px">
        <div class="text-h5">Action Template</div>
        <div class="flex column" style="gap: 12px; margin-top: 16px">
            <div>
                <label for="dockerImage">Action Name *</label>
                <q-input
                    v-model="templateName"
                    name="dockerImage"
                    outlined
                    dense
                    clearable
                    debounce="300"
                    placeholder="Action Name"
                    @clear="onInputClear"
                />
                <ErrorMessage
                    :errors="errors"
                    field-path="actionTemplate.templateName"
                />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ErrorMessage from 'components/action-submission/settings/error-message.vue';
import { ActionConfigurationValidationError } from 'components/action-submission/types';
import { defineModel, watch } from 'vue';

const templateName = defineModel<string>('templateName', {
    required: true,
});
defineModel<undefined | string>('parentTemplate', { required: true });
const errors = defineModel<ActionConfigurationValidationError[]>('errors', {
    required: true,
});

watch(
    () => templateName.value,
    (name) => {
        const newErrors = errors.value.filter(
            (error) => error.fieldPath !== 'actionTemplate.templateName',
        );

        if (name.length === 0) {
            newErrors.push({
                fieldPath: 'actionTemplate.templateName',
                errorMessage: 'Please select a template name.',
            });
        }

        errors.value = newErrors;
    },
);

const onInputClear = (): void => {
    templateName.value = '';
};
</script>
