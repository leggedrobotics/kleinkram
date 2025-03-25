<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Metadata</template>

        <template #content>
            <AddTag :mission-uuid="mission_uuid" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Add Metadata"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
    >
</template>

<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import AddTag from 'components/AddTag.vue';
import BaseDialog from './base-dialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { mission_uuid } = defineProps<{
    mission_uuid: string;
}>();
</script>

<style scoped></style>
