<template>
    <base-dialog ref="dialogRef">
        <template #title> Create Access Group </template>

        <template #content>
            <label for="name">Group Name</label>
            <q-input
                v-model="name"
                placeholder="Name"
                name="name"
                :error-message="errorMessagesProjectName"
                :error="isInErrorStateProjectName"
                autofocus
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Access Group"
                class="bg-button-primary"
                :disable="isInErrorStateProjectName"
                @click="createAccessGroup"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { QInput, useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref, watch } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const isInErrorStateProjectName = ref(false);
const errorMessagesProjectName = ref<string>();
const name = ref('');

watch(name, () => {
    if (/^[\w\-_]{3,20}$/.test(name.value)) {
        isInErrorStateProjectName.value = false;
        errorMessagesProjectName.value = '';
    } else {
        isInErrorStateProjectName.value = true;
        errorMessagesProjectName.value =
            'Name must be between 3 and 20 characters and only contain letters, numbers, -, and _';
    }
});

const createAccessGroup = (): void => {
    onDialogOK(name);
};
</script>

<style scoped></style>
