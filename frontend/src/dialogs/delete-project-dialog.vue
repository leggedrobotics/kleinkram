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
import DeleteProject from 'components/delete-project.vue';
import { useDialogPluginComponent } from 'quasar';
import BaseDialog from 'src/dialogs/base-dialog.vue';
import { useProjectQuery } from 'src/hooks/query-hooks';
import { computed, ref } from 'vue';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteProject = ref<InstanceType<typeof DeleteProject> | undefined>(
    undefined,
);

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

const { data: project } = useProjectQuery(computed(() => projectUuid));

const deleteProjectAction = (): void => {
    if (deleteProject.value === undefined) return;
    // @ts-ignore
    deleteProject.value.deleteProjectAction();
    onDialogOK();
};
</script>
