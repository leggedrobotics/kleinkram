<template>
    <base-dialog ref="dialogRef">
        <template #title> Access Rights</template>

        <template #content>
            <q-input v-model="name" label="Name" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create"
                class="bg-button-primary"
                @click="() => onDialogOK(name)"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const name = ref('');
</script>

<style scoped></style>
