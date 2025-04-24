<template>
    <div
        v-if="
            filteredErrors.length > 0 &&
            filteredErrors.some((error) => error.errorMessage !== '')
        "
        class="q-mt-sm text-negative text-caption"
    >
        <q-icon name="sym_o_error" class="q-mr-sm" />
        <span v-for="error in filteredErrors" :key="error.errorMessage">
            {{ error.errorMessage }}
            <br>
        </span>
    </div>
</template>
<script setup lang="ts">
import { ActionConfigurationValidationError } from 'components/action-submission/types';
import { computed } from 'vue';

const properties = defineProps<{
    errors: ActionConfigurationValidationError[];
    fieldPath: string;
}>();

const filteredErrors = computed(() => {
    return properties.errors.filter(
        (error) => error.fieldPath === properties.fieldPath,
    );
});
</script>
