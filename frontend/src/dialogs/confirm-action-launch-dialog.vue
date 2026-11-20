<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
    >
        <template #title>Launch Action?</template>
        <template #content>
            <p class="q-ma-none">
                This action has <b>{{ access }}</b> access:
                {{
                    access === 'delete'
                        ? 'it can delete any file in this project.'
                        : 'it can change or overwrite files in this project.'
                }}
            </p>
        </template>
        <template #actions>
            <q-btn
                flat
                no-caps
                label="Launch Action"
                class="bg-button-primary"
                :loading="running"
                @click="confirm"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import { useDialogAction } from 'src/composables/use-dialog-action';
import BaseDialog from 'src/dialogs/base-dialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const { running, errorMessage, run } = useDialogAction(onDialogOK);
const confirm = (): Promise<void> => run(action);

const { action } = defineProps<{
    /** The request to run on confirm; the dialog closes when it succeeds */
    action: () => Promise<unknown>;
    /** The project rights the action runs with */
    access: 'write' | 'delete';
}>();
</script>
