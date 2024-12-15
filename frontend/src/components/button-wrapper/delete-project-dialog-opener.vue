<template>
    <div
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
        @click="deleteProject"
    >
        <slot />

        <q-tooltip v-if="!canDelete && !has_missions">
            You do not have permission to delete this project
        </q-tooltip>
        <q-tooltip v-else-if="has_missions">
            You cannot delete a project with missions
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canDeleteProject, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';
import DeleteProjectDialog from '../../dialogs/delete-project-dialog.vue';

const { project_uuid, has_missions } = defineProps<{
    project_uuid: string;
    has_missions: boolean;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(
    () => canDeleteProject(project_uuid, permissions.value) && !has_missions,
);

const $q = useQuasar();

const deleteProject = (): void => {
    // abort if the user cannot modify the project
    if (!canDelete.value) return;

    // open the dialog
    $q.dialog({
        title: 'Delete Project',
        component: DeleteProjectDialog,
        componentProps: {
            project_uuid: project_uuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
