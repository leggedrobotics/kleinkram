<template>
    <base-dialog ref="dialogRef">
        <template #title> Create File</template>

        <template #content>
            <create-file
                ref="createFileRef"
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
import { MissionWithFilesDto } from '@api/types/Mission.dto';
import { FileUploadDto } from '@api/types/Upload.dto';
import CreateFile from '../components/CreateFile.vue';

const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);
const ready = ref(false);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

defineProps<{
    mission?: MissionWithFilesDto;
    uploads: Ref<FileUploadDto[]>;
}>();

const createFileAction = (): void => {
    // @ts-ignore
    createFileRef.value.createFileAction();
    onDialogOK();
};
</script>
