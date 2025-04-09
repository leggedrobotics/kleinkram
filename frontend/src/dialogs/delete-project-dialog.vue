<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Project</template>
        <template #content>
            <DeleteProject
                v-if="project"
                ref="deleteProject"
                :project="project"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="deleteProject?.project_name_check !== project?.name"
                label="Delete Project"
                class="bg-button-danger"
                @click="deleteProjectAction"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from './base-dialog.vue';
import { computed, ref } from 'vue';
import { useProjectQuery } from '../hooks/query-hooks';
import DeleteProject from '@components/delete-project.vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteProject = ref<InstanceType<typeof DeleteProject> | undefined>(
    undefined,
);

const { project_uuid } = defineProps<{
    project_uuid: string;
}>();

const { data: project } = useProjectQuery(computed(() => project_uuid));

const deleteProjectAction = (): void => {
    if (deleteProject.value === undefined) return;
    // @ts-ignore
    deleteProject.value.deleteProjectAction();
    onDialogOK();
};
</script>
