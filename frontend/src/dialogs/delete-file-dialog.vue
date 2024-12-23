<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete File</template>
        <template #content>
            <delete-file v-if="file" ref="deleteFileReference" :file="file" />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteFileReference?.file_name_check !== file?.filename
                "
                label="Delete File"
                class="bg-button-primary"
                @click="deleteFileAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { ref } from 'vue';

import { FileWithTopicDto } from '@api/types/files/file.dto';
import DeleteFile from '@components/delete-file.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteFileReference = ref<InstanceType<typeof DeleteFile> | undefined>(
    undefined,
);

const { file } = defineProps<{
    file: FileWithTopicDto;
}>();

const deleteFileAction = (): void => {
    if (deleteFileReference.value === undefined) return;
    deleteFileReference.value.deleteFileAction();
    onDialogOK();
};
</script>
