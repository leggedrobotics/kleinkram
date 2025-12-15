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
import EditProject from 'components/edit-project.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { ref } from 'vue';

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (editProjectReference.value) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        editProjectReference.value
            .save_changes()
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            .then(onDialogOK)
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            .catch(() => {
                console.error('Error saving project');
            });
    }
};
</script>
<style scoped></style>
