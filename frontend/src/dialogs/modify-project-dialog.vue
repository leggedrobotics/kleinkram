<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Project</template>

        <template #content>
            <edit-project
                ref="editProjectReference"
                :project_uuid="project_uuid"
            />
        </template>

        <template #actions>
            <q-btn
                flat
                label="Save Project"
                class="bg-button-primary"
                @click="saveProjects"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import { useDialogPluginComponent } from 'quasar';
import { ref } from 'vue';
import EditProject from '@components/edit-project.vue';

const editProjectReference = ref<InstanceType<typeof EditProject> | null>(null);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { project_uuid } = defineProps<{
    project_uuid: string;
}>();

// verify that the project_uuid is not empty
if (project_uuid === '') throw new Error('Project UUID is required');

const saveProjects = (): void => {
    if (editProjectReference.value === null) return;
    editProjectReference.value
        // @ts-ignore
        .save_changes()
        .then(onDialogOK)
        .catch(() => {
            console.error('Error saving project');
        });
};
</script>
<style scoped></style>
