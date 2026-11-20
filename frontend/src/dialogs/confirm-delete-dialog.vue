<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
        :submit-disabled="!confirmed || running"
        @submit="confirm"
    >
        <template #title>{{ actionLabel }}</template>

        <template #content>
            <ul class="q-mt-none">
                <li v-for="filename in filenames.slice(0, 5)" :key="filename">
                    {{ filename }}
                </li>
                <li v-if="filenames.length > 6">...</li>
                <li v-if="filenames.length >= 6">
                    {{ filenames.slice(-1)[0] }}
                </li>
            </ul>
            <label :for="inputId" class="confirm-label">
                Type <b>{{ confirmationText }}</b> to confirm. This can't be
                undone.
            </label>
            <q-input
                v-model="confirmationInput"
                no-error-icon
                :for="inputId"
                outlined
                autofocus
                dense
                autocomplete="off"
            />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :disable="!confirmed"
                    :label="actionLabel"
                    class="bg-button-danger"
                    :loading="running"
                    @click="confirm"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the text above to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { useDialogAction } from 'src/composables/use-dialog-action';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const { running, errorMessage, run } = useDialogAction(onDialogOK);
const confirm = (): Promise<void> => run(action);

const { filenames, action } = defineProps<{
    /** The request to run on confirm; the dialog closes when it succeeds */
    action: () => Promise<unknown>;
    filenames: string[];
}>();

const inputId = `confirm-delete-${useId()}`;
const confirmationInput = ref('');
const confirmationText = computed(
    () => `delete ${String(filenames.length)} files`,
);
const confirmed = computed(
    () => confirmationInput.value === confirmationText.value,
);
const actionLabel = computed(() =>
    filenames.length === 1
        ? 'Delete File'
        : `Delete ${String(filenames.length)} Files`,
);
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
}
</style>
