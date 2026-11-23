<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
    >
        <template #title>Sign Out All Other Sessions</template>
        <template #content>
            <p class="q-ma-none">
                This ends
                {{
                    count === 1
                        ? '1 other session'
                        : `${String(count)} other sessions`
                }}: other browsers and Kleinkram CLI logins. They need to log in
                again. This browser stays signed in.
            </p>
        </template>
        <template #actions>
            <q-btn
                label="Sign Out"
                flat
                no-caps
                class="bg-button-danger"
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

const { count, action } = defineProps<{
    /** The request to run on confirm; the dialog closes when it succeeds */
    action: () => Promise<unknown>;
    count: number;
}>();
</script>
