<template>
    <!-- here we need to set the height explicitly to avoid a visual bug -->
    <base-dialog ref="dialogRef" content-height="366px">
        <template #title> Define Metadata Field</template>

        <template #content>
            <create-metadata-type ref="metadataTypeForm" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Metadata"
                class="bg-button-primary"
                @click="createMetadataTypeAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import CreateMetadataType from 'components/metadata/create-metadata-type.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

const metadataTypeForm = ref();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const createMetadataTypeAction = async (): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (!(await metadataTypeForm.value.createMetadataTypeAction())) {
        // eslint-disable-next-line no-console
        console.log('Error creating Metadata');
        return;
    }

    onDialogOK();
};
</script>
