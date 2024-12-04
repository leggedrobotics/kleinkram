<template>
    <base-dialog ref="dialogRef">
        <template #title> Delete Project </template>
        <template #content>
            <DeleteProject
                v-if="project"
                ref="deleteProjectRef"
                :project="project"
            />
            <q-skeleton v-else height="250px" />
        </template>

        <template #actions>
            <q-btn
                flat
                :disable="
                    deleteProjectRef?.project_name_check !== project?.name
                "
                label="Delete Project"
                class="bg-button-primary"
                @click="deleteProject"
            />
        </template>
    </base-dialog>
</template>
<script setup lang="ts">
import { useDialogPluginComponent } from 'quasar';
import DeleteProject from 'components/DeleteProject.vue';
import BaseDialog from './base-dialog.vue';
import { computed, ref } from 'vue';
import { useProjectQuery } from 'src/hooks/customQueryHooks';

const { dialogRef, onDialogOK } = useDialogPluginComponent();
const deleteProjectRef = ref<InstanceType<typeof DeleteProject> | null>(null);

const { project_uuid } = defineProps({
    project_uuid: String,
});

const { data: project } = useProjectQuery(computed(() => project_uuid));

const deleteProject = (): void => {
    if (deleteProjectRef.value === null) return;
    // @ts-ignore
    deleteProjectRef.value.deleteProjectAction();
    onDialogOK();
};
</script>
