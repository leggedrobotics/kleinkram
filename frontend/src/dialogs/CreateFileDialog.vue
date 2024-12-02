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
                @click="createFile"
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Ref, ref } from 'vue';
import { MissionDto } from '@api/types/Mission.dto';
import { FileUploadDto } from '@api/types/Upload.dto';

const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);
const ready = ref(false);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

defineProps<{
    mission?: MissionDto;
    uploads: Ref<FileUploadDto[]>;
}>();

const createFile = (): void => {
    createFileRef.value.createFileAction();
    onDialogOK();
};
</script>
