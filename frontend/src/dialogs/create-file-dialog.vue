<template>
    <base-dialog ref="dialogRef">
        <template #title> Create File</template>

        <template #content>
            <create-file
                ref="createFileReference"
                v-model:ready="ready"
                :mission="mission"
                :uploads="uploads"
                :disable-scope="!!mission"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create File"
                class="bg-button-primary"
                :disable="!ready"
                @click="createFileAction"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
import CreateFile from 'components/create-file.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { Ref, ref } from 'vue';

const createFileReference = ref<InstanceType<typeof CreateFile> | undefined>(
    undefined,
);
const ready = ref(false);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

defineProps<{
    mission?: FlatMissionDto;
    uploads: Ref<FileUploadDto[]>;
}>();

const createFileAction = (): void => {
    if (createFileReference.value === undefined) return;
    if (createFileReference.value) {
        (createFileReference.value as any).createFileAction();
    }
    onDialogOK();
};
</script>
