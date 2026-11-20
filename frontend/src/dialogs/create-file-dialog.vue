<template>
    <base-dialog ref="dialogRef" size="lg">
        <template #title>Upload Files</template>

        <template #content>
            <create-file
                ref="createFileReference"
                v-model:ready="ready"
                :mission="mission"
                :uploads="uploads"
                :disable-scope="!!mission"
                :initial-files="initialFiles ?? []"
            />
        </template>

        <template #actions>
            <span class="disabled-reason">
                <q-btn
                    no-caps
                    flat
                    label="Upload"
                    class="bg-button-primary"
                    :disable="!ready"
                    @click="createFileAction"
                />
                <q-tooltip v-if="!ready"
                    >Choose a mission and valid files</q-tooltip
                >
            </span>
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import type { FlatMissionDto } from '@kleinkram/api-dto/types/mission/mission.dto';
import type { FileUploadDto } from '@kleinkram/api-dto/types/upload.dto';
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
    initialFiles?: File[];
}>();

const createFileAction = (): void => {
    if (createFileReference.value === undefined) return;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (createFileReference.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (createFileReference.value as any).createFileAction();
    }
    onDialogOK();
};
</script>
