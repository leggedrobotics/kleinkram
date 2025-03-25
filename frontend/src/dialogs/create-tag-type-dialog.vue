<template>
    <!-- here we need to set the height explicitly to avoid a visual bug -->
    <base-dialog ref="dialogRef" content-height="366px">
        <template #title> Define Metadata Field</template>

        <template #content>
            <create-tag-type ref="tagType" />
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
import { ref } from 'vue';
import { useDialogPluginComponent } from 'quasar';
import CreateTagType from '@components/create-tag-type.vue';
import BaseDialog from './base-dialog.vue';

const tagType = ref();

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const createTagTypeAction = async (): Promise<void> => {
    if (!(await tagType.value.createTagTypeAction())) {
        console.log('Error creating Metadata');
        return;
    }

    console.log(tagType.value.createTagTypeAction());
    onDialogOK();
};
</script>
