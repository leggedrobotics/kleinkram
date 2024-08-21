<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete File</template>
        <template #content>
            <delete-file :file="file" />
        </template>
        <template #actions>
            <q-btn
                flat
                label="Delete File"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import DeleteFile from 'components/DeleteFile.vue';
import { useDialogPluginComponent } from 'quasar';
import { FileEntity } from 'src/types/FileEntity';
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    file: FileEntity;
}>();
</script>
<style scoped></style>
