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
                @click="
                    () => {
                        createFileRef?.createFileAction();
                        onDialogOK();
                    }
                "
            />
        </template>
    </base-dialog>
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import CreateFile from 'components/CreateFile.vue';
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import { ref } from 'vue';

const createFileRef = ref<InstanceType<typeof CreateFile> | null>(null);
const ready = ref(false);

const { dialogRef, onDialogOK } = useDialogPluginComponent();
</script>
