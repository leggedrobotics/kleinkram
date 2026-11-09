<template>
    <div
        v-if="hasPermission"
        :class="hasMissions ? 'disabled cursor-not-allowed' : 'cursor-pointer'"
        @click="deleteProject"
    >
        <slot />
        <q-tooltip v-if="hasMissions">
            A project with missions cannot be deleted. Delete or move its
            missions first.
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteProjectDialog from 'src/dialogs/delete-project-dialog.vue';
import { canDeleteProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const { projectUuid, hasMissions } = defineProps<{
    projectUuid: string;
    hasMissions: boolean;
}>();

const { data: permissions } = usePermissionsQuery();
const hasPermission = computed(() =>
    canDeleteProject(projectUuid, permissions.value),
);

const $q = useQuasar();

const deleteProject = (): void => {
    // abort if the user cannot modify the project
    if (!hasPermission.value || hasMissions) return;

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
