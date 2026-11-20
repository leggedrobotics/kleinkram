<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
        :submit-disabled="!confirmed || running"
        @submit="confirm"
    >
        <template #title>Delete File</template>
        <template #content>
            <label :for="inputId" class="confirm-label">
                Type <b>{{ filename }}</b> to confirm. This can't be undone.
            </label>
            <q-input
                v-model="fileNameCheck"
                no-error-icon
                :for="inputId"
                outlined
                dense
                autofocus
                autocomplete="off"
            />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    flat
                    no-caps
                    :disable="!confirmed"
                    label="Delete File"
                    class="bg-button-danger"
                    :loading="running"
                    @click="confirm"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the file name to confirm</q-tooltip
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
const fileNameCheck = ref('');
const inputId = `confirm-delete-file-${useId()}`;

const { filename, action } = defineProps<{
    /** The request to run on confirm; the dialog closes when it succeeds */
    action: () => Promise<unknown>;
    filename: string;
}>();

const confirmed = computed(() => fileNameCheck.value === filename);
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
