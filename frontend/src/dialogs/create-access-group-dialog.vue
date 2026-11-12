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
                :error="!!name && !!nameError"
                outlined
                dense
                autofocus
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Access Group"
                class="bg-button-primary"
                :disable="!!nameError"
                @click="createAccessGroup"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { getNameValidationError } from '@kleinkram/validation/frontend';
import { QInput, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const name = ref('');
const nameError = computed(
    () => getNameValidationError(name.value, 'Group name') ?? '',
);

const createAccessGroup = (): void => {
    onDialogOK(name);
};
</script>

<style scoped></style>
