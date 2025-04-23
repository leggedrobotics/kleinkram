<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Project</template>

        <template #content>
            <edit-project
                ref="editProjectReference"
                :project-uuid="projectUuid"
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

const editProjectReference = ref<InstanceType<typeof EditProject> | undefined>(
    undefined,
);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

// verify that the projectUuid is not empty
if (projectUuid === '') throw new Error('Project UUID is required');

const saveProjects = (): void => {
    if (editProjectReference.value === undefined) return;
    editProjectReference.value
        .save_changes()
        .then(onDialogOK)
        .catch(() => {
            console.error('Error saving project');
        });
};
</script>
<style scoped></style>
