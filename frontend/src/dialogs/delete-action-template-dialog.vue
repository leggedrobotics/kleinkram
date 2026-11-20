<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="running"
        size="sm"
        :submit-disabled="!confirmed || isBlocked || running"
        @submit="confirm"
    >
        <template #title>{{ actionLabel }}</template>
        <template v-if="isBlocked" #content>
            <p class="q-mb-none">
                Used by <b>{{ template.triggerCount }}</b>
                {{ template.triggerCount === 1 ? 'trigger' : 'triggers' }}.
                Delete or change
                {{ template.triggerCount === 1 ? 'it' : 'them' }} first.
            </p>
        </template>
        <template v-else #content>
            <p v-if="isArchiving">
                This template has
                <b>{{ template.executionCount }}</b> executions, so it is
                archived instead of deleted.
            </p>
            <label :for="inputId" class="confirm-label">
                Type <b>{{ template.name }}</b> to confirm.{{
                    isArchiving ? '' : " This can't be undone."
                }}
            </label>
            <q-input
                v-model="nameCheck"
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
                    :disable="!confirmed || isBlocked"
                    :label="actionLabel"
                    class="bg-button-danger"
                    :loading="running"
                    @click="confirm"
                />
                <q-tooltip v-if="isBlocked">Used by a trigger</q-tooltip>
                <q-tooltip v-else-if="!confirmed"
                    >Type the name to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
/**
 * Runs the caller's `action` (delete or archive) on confirm and closes when
 * it succeeds. A template a trigger still uses cannot be deleted.
 */
import type { ActionTemplateDto } from '@kleinkram/api-dto/types/actions/action-template.dto';
import { useDialogPluginComponent } from 'quasar';
import { useDialogAction } from 'src/composables/use-dialog-action';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref, useId } from 'vue';

const { template, action } = defineProps<{
    /** The request to run on confirm; the dialog closes when it succeeds */
    action: () => Promise<unknown>;
    template: ActionTemplateDto;
}>();

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const { running, errorMessage, run } = useDialogAction(onDialogOK);
const confirm = (): Promise<void> => run(action);

const inputId = `delete-template-${useId()}`;
const nameCheck = ref('');
const confirmed = computed(() => nameCheck.value === template.name);
const isArchiving = computed(() => template.executionCount > 0);
// triggers keep running a template, so it can't go away while one uses it
const isBlocked = computed(() => template.triggerCount > 0);
const actionLabel = computed(() =>
    isArchiving.value ? 'Archive Template' : 'Delete Template',
);
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
