<template>
    <base-dialog ref="dialogRef">
        <template #title>
            Are you sure you want to delete the following
            {{ filenames.length }}
            {{ filenames.length === 1 ? 'file' : 'files' }}?
        </template>

        <template #content>
            <div>
                <p style="font-size: 16pt" />
                <ul>
                    <li
                        v-for="filename in filenames.slice(0, 5)"
                        :key="filename"
                    >
                        {{ filename }}
                    </li>
                    <li v-if="filenames.length > 6">...</li>
                    <li v-if="filenames.length >= 6">
                        {{ filenames.slice(-1)[0] }}
                    </li>
                </ul>
            </div>
        </template>

        <template #actions>
            <div class="flex justify-end">
                <q-btn flat label="Cancel" @click="onDialogCancel" />
                <q-btn
                    unelevated
                    label="Delete"
                    color="negative"
                    icon="sym_o_delete"
                    @click="onDialogOK"
                />
            </div>
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const { filenames } = defineProps<{
    filenames: string[];
}>();
</script>

<style scoped></style>
