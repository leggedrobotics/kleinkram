<template>
    <base-dialog ref="dialogRef">
        <template #title> Create File</template>

        <template #content>
            <create-file
                :mission="mission"
                ref="createFileRef"
                :uploads="uploads"
                v-model:ready="ready"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create File"
                class="bg-button-primary"
                :disable="!ready"
                @click="
                    () => {
                        createFileRef?.createFileAction();
                        onDialogOK();
                    }
                "
            />
        </template>
    </base-dialog>
    >
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import { Mission } from 'src/types/Mission';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { Ref, ref } from 'vue';
import { FileUpload } from 'src/types/FileUpload';

const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);
const ready = ref(false);
const props = defineProps<{
    mission?: Mission;
    uploads: Ref<FileUpload[]>;
}>();
const { dialogRef, onDialogOK } = useDialogPluginComponent();
</script>
