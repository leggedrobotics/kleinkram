<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete File </template>
        <template #content>
            <delete-file v-if="file" ref="deleteFileRef" :file="file" />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="deleteFileRef?.file_name_check !== file?.filename"
                label="Delete File"
                class="bg-button-primary"
                @click="
                    () => {
                        deleteFileRef?.deleteFileAction();
                        onDialogOK();
                    }
                "
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';
import DeleteFile from 'components/DeleteFile.vue';
import { FileEntity } from 'src/types/FileEntity';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteFileRef = ref<InstanceType<typeof DeleteFile> | null>(null);

const { file } = defineProps({
    file: FileEntity,
});
</script>
