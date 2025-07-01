<template>
    <div class="flex row justify-end q-mt-lg">
        <q-btn
            flat
            class="bg-button-secondary text-on-color q-mx-sm"
            label="Save Action"
            :disable="properties.errors.length > 0"
            @click="save"
        />

        <q-btn
            flat
            class="bg-button-secondary text-on-color"
            label="Save And Run Action"
            :disable="properties.errors.length > 0"
            @click="saveAndRun"
        />
    </div>
</template>

<script setup lang="ts">
import { ActionConfigurationValidationError } from 'components/action-submission/types';
import { defineEmits } from 'vue';

const properties = defineProps<{
    errors: ActionConfigurationValidationError[];
}>();

const emits = defineEmits(['save', 'saveAndRun']);
const saveAndRun = (): void => emits('saveAndRun');
const save = (): void => emits('save');
</script>
