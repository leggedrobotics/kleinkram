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

        <q-tooltip v-if="!canDelete && !hasMissions">
            You do not have permission to delete this project
        </q-tooltip>
        <q-tooltip v-else-if="hasMissions">
            You cannot delete a project with missions
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canDeleteProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';
import DeleteProjectDialog from 'src/dialogs/delete-project-dialog.vue';

const { projectUuid, hasMissions } = defineProps<{
    projectUuid: string;
    hasMissions: boolean;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(
    () => canDeleteProject(projectUuid, permissions.value) && !hasMissions,
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
            projectUuid: projectUuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
