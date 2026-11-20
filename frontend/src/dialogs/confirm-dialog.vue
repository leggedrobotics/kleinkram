<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
        :cancel-label="cancelLabel"
    >
        <template #title>{{ title }}</template>
        <template v-if="subtitle" #subtitle>{{ subtitle }}</template>
        <template v-if="message" #content>
            <p class="q-ma-none">{{ message }}</p>
        </template>
        <template #actions>
            <q-btn
                flat
                no-caps
                :label="okLabel"
                :class="danger ? 'bg-button-danger' : 'bg-button-primary'"
                :loading="running"
                @click="confirm"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
/**
 * A yes/no question on the standard dialog frame. Use it instead of Quasar's
 * built-in dialog (`Dialog.create({ title, message })`).
 */
import { useDialogPluginComponent } from 'quasar';
import { useDialogAction } from 'src/composables/use-dialog-action';
import BaseDialog from 'src/dialogs/base-dialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const {
    subtitle = '',
    message = '',
    cancelLabel = 'Cancel',
    action,
} = defineProps<{
    title: string;
    /** A user-provided name the question is about, e.g. the project */
    subtitle?: string;
    message?: string;
    okLabel: string;
    cancelLabel?: string;
    /** The confirmed action deletes or takes something away */
    danger?: boolean;
    /**
     * The request the question confirms. The dialog stays open while it
     * runs and shows a failure itself; without it, OK just closes.
     */
    // eslint-disable-next-line vue/require-default-prop
    action?: (() => Promise<unknown>) | undefined;
}>();

const { running, errorMessage, run } = useDialogAction(() => {
    onDialogOK();
});
const confirm = async (): Promise<void> => {
    if (action === undefined) {
        onDialogOK();
        return;
    }
    await run(action);
};
</script>
