<template>
    <base-dialog ref="dialogRef">
        <template #title> Create Access Group </template>

        <template #content>
            <label for="name" class="text-weight-bold">
                Group Name<span class="text-negative">*</span>
            </label>
            <q-input
                v-model="name"
                placeholder="Name..."
                name="name"
                :error-message="nameError"
                :error="!!nameError && (!!name || !!serverError)"
                outlined
                dense
                autofocus
                @update:model-value="clearServerError"
                @keyup.enter="createAccessGroup"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Access Group"
                class="bg-button-primary"
                :disable="!!nameError"
                :loading="isPending"
                @click="createAccessGroup"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { getNameValidationError } from '@kleinkram/validation/frontend';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import { Notify, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { getErrorMessage, getErrorStatus } from 'src/services/error-handling';
import { createAccessGroup as createAccessGroupRequest } from 'src/services/mutations/access';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const queryClient = useQueryClient();

const name = ref('');
// a taken name, reported by the server on the name input
const serverError = ref('');
const nameError = computed(
    () =>
        serverError.value ||
        (getNameValidationError(name.value, 'Group name') ?? ''),
);
const clearServerError = (): void => {
    serverError.value = '';
};

// the dialog stays open until the group exists, so a rejected name can be
// fixed without typing it again
const { mutate, isPending } = useMutation({
    mutationFn: (groupName: string) => createAccessGroupRequest(groupName),
    onSuccess: async () => {
        await queryClient.invalidateQueries({
            predicate: (query) => query.queryKey[0] === 'accessGroups',
        });
        Notify.create({
            message: 'Access Group Created',
            color: 'positive',
            position: 'bottom',
            timeout: 2000,
        });
        onDialogOK();
    },
    onError: (error: Error) => {
        if (getErrorStatus(error) === 409) {
            serverError.value = getErrorMessage(error);
            return;
        }
        Notify.create({
            message: `Failed to create access group: ${getErrorMessage(error)}`,
            color: 'negative',
            position: 'bottom',
        });
    },
});

const createAccessGroup = (): void => {
    if (isPending.value || nameError.value) return;
    mutate(name.value.trim());
};
</script>

<style scoped></style>
