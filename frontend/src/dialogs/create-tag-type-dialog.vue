<template>
    <base-dialog ref="dialogRef">
        <template #title> Create Metadata</template>

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

const createTagTypeAction = async (): void => {
    if (!(await tagType.value.createTagTypeAction())) {
        console.log('Error creating Metadata');
        return;
    }

    console.log(tagType.value.createTagTypeAction());
    onDialogOK();
};
</script>
