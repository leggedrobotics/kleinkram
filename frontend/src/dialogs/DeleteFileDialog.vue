<template>
    <q-dialog ref="dialogRef">
        <q-card
            class="q-pa-sm text-center"
            style="width: 80%; min-height: 250px; max-width: 500px"
        >
            <delete-file :file="file" />
        </q-card>
    </q-dialog>
</template>
<script setup lang="ts">
import DeleteFile from 'components/DeleteFile.vue';
import { useDialogPluginComponent } from 'quasar';
import { FileEntity } from 'src/types/FileEntity';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    file: FileEntity;
}>();
</script>
<style scoped></style>
