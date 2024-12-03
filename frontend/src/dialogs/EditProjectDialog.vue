<template>
    <base-dialog ref="dialogRef">
        <template #title> Edit Project</template>

        <template #content>
            <edit-project
                ref="editProjectRef"
                :project_uuid="props.project_uuid"
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
import BaseDialog from 'src/dialogs/BaseDialog.vue';
import EditProject from 'components/EditProject.vue';
import { useDialogPluginComponent } from 'quasar';
import { ref } from 'vue';

const editProjectRef = ref<InstanceType<typeof EditProject> | null>(null);

const { dialogRef, onDialogOK } = useDialogPluginComponent();

const props = defineProps<{
    project_uuid: string;
}>();

const saveProjects = (): void => {
    if (editProjectRef.value === null) return;
    editProjectRef.value
        // @ts-ignore
        .save_changes()
        .then(onDialogOK)
        .catch(() => {
            console.error('Error saving project');
        });
};
</script>
<style scoped></style>
