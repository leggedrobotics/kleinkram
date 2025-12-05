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
                class="bg-button-danger"
                @click="deleteFileAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

import type { FileWithTopicDto } from '@kleinkram/api-dto/types/file/file.dto';
import DeleteFile from 'components/delete-file.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteFileReference = ref<InstanceType<typeof DeleteFile> | undefined>(
    undefined,
);

const { file } = defineProps<{
    file: FileWithTopicDto;
}>();

const deleteFileAction = (): void => {
    if (deleteFileReference.value === undefined) return;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (deleteFileReference.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (deleteFileReference.value as any).deleteFileAction();
    }
    onDialogOK();
};
</script>
