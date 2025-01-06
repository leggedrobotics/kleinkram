<template>
    <base-dialog ref="dialogRef">
        <template #title> Create File</template>

        <template #content>
            <create-file
                ref="createFileReference"
                v-model:ready="ready"
                :mission="mission"
                :uploads="uploads"
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
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { Ref, ref } from 'vue';
import { FlatMissionDto } from '@api/types/mission.dto';
import { FileUploadDto } from '@api/types/upload.dto';
import CreateFile from '@components/create-file.vue';

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
    createFileReference.value.createFileAction();
    onDialogOK();
};
</script>
