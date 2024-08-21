<template>
    <base-dialog ref="dialogRef">
        <template #title> Add Tag</template>

        <template #content>
            <AddTag :mission_uuid="props.mission_uuid" />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Add Tag"
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
import BaseDialog from 'src/dialogs/BaseDialog.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    mission_uuid: string;
}>();
</script>

<style scoped></style>
