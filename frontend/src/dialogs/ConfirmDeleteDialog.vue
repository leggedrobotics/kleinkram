<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="flex column q-pa-lg"
            style="min-height: 300px; min-width: 600px"
        >
            <div>
                <p style="font-size: 16pt">
                    Are you sure you want to delete the following
                    {{ filenames.length }}
                    {{ filenames.length === 1 ? 'file' : 'files' }}?
                </p>
                <ul>
                    <li
                        v-for="filename in props.filenames.slice(0, 5)"
                        :key="filename"
                    >
                        {{ filename }}
                    </li>
                    <li>...</li>
                    <li>{{ props.filenames.slice(-1)[0] }}</li>
                </ul>
            </div>
            <div class="flex justify-end">
                <q-btn flat label="Cancel" @click="onDialogCancel" />
                <q-btn
                    unelevated
                    label="Delete"
                    color="negative"
                    @click="onDialogOK"
                    icon="sym_o_delete"
                />
            </div>
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK, onDialogCancel } = useDialogPluginComponent();

const props = defineProps<{
    filenames: string[];
}>();
</script>

<style scoped></style>
