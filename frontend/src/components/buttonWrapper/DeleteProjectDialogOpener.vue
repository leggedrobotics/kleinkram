<template>
    <div
        @click="deleteProject"
        :class="{
            disabled: !canDelete,
            'cursor-pointer': !canDelete,
            'cursor-not-allowed': canDelete,
        }"
    >
        <slot />

        <q-tooltip v-if="!canDelete">
            You do not have permission to delete this project
        </q-tooltip>
    </div>
</template>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import DeleteProjectDialog from 'src/dialogs/DeleteProjectDialog.vue';
import {
    canDeleteProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(() =>
    canDeleteProject(project_uuid, permissions.value),
);

const $q = useQuasar();

const deleteProject = () => {
    // abort if the user cannot modify the project
    if (!canDelete.value) return;

    // open the dialog
    $q.dialog({
        title: 'Delete Project',
        component: DeleteProjectDialog,
        componentProps: {
            project_uuid,
        },
    });
};
</script>
