<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Project</template>

        <template #content>
            <edit-project
                :project_uuid="props.project_uuid"
                @close="onDialogOK"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Save Project"
                class="bg-button-primary"
                @click="onDialogOK"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import EditProject from 'components/EditProject.vue';
import { useDialogPluginComponent } from 'quasar';

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();
</script>
<style scoped></style>
