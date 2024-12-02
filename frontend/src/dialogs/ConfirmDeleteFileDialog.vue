<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete File</template>
        <template #content>
            <q-card-section class="q-pa-md">
                <p>
                    Please confirm by entering the Filename:
                    <b>{{ filename }}</b>
                </p>
                <q-input
                    v-model="file_name_check"
                    outlined
                    placeholder="Confirm File Name"
                    autofocus
                />
            </q-card-section>
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="file_name_check !== filename"
                label="Delete File"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const file_name_check = ref('');

const props = defineProps<{
    filename: string;
}>();
</script>
