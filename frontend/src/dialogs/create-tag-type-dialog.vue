<template>
    <!-- here we need to set the height explicitly to avoid a visual bug -->
    <base-dialog ref="dialogRef" content-height="366px">
        <template #title> Define Metadata Field</template>

        <template #content>
            <create-metadata-type ref="tagType" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Create Metadata"
                class="bg-button-primary"
                @click="createTagTypeAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import CreateMetadataType from 'components/metadata/create-metadata-type.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

const tagType = ref();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const createTagTypeAction = async (): Promise<void> => {
    if (!(await tagType.value.createTagTypeAction())) {
        console.log('Error creating Metadata');
        return;
    }

    onDialogOK();
};
</script>
