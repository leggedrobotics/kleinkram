<template>
    <base-dialog
        ref="dialogRef"
        v-model:error="errorMessage"
        :busy="deleting"
        size="sm"
        :submit-disabled="!confirmed || deleting"
        @submit="deleteActionAction"
    >
        <template #title>Delete Action</template>
        <template #content>
            <label :for="inputId" class="confirm-label">
                Type <b>{{ action.template.name }}</b> to confirm. This can't be
                undone.
            </label>
            <q-input
                v-model="actionNameCheck"
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
                    :loading="deleting"
                    label="Delete Action"
                    class="bg-button-danger"
                    @click="deleteActionAction"
                />
                <q-tooltip v-if="!confirmed"
                    >Type the name to confirm</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { ActionDto } from '@kleinkram/api-dto/types/actions/action.dto';
import { Notify, useDialogPluginComponent } from 'quasar';
import { useDeleteAction } from 'src/composables/use-action-mutations';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getDialogErrorMessage } from 'src/services/error-handling';
import { computed, ref, useId } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { action } = defineProps<{
    action: ActionDto;
}>();

const { mutateAsync: removeAction } = useDeleteAction();

const inputId = `delete-action-${useId()}`;
const actionNameCheck = ref('');
const deleting = ref(false);
const errorMessage = ref('');
const confirmed = computed(
    () => actionNameCheck.value === action.template.name,
);

async function deleteActionAction(): Promise<void> {
    if (!confirmed.value || deleting.value) return;
    deleting.value = true;
    errorMessage.value = '';
    try {
        await removeAction(action.uuid);
    } catch (error: unknown) {
        errorMessage.value = getDialogErrorMessage(error);
        return;
    } finally {
        deleting.value = false;
    }
    Notify.create({
        message: 'Action deleted',
        color: 'positive',
        timeout: 2000,
        position: 'bottom',
    });
    onDialogOK();
}
</script>

<style scoped>
.confirm-label {
    display: block;
    margin-bottom: 4px;
    overflow-wrap: anywhere;
}
</style>
