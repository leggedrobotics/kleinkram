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

        <q-tooltip v-if="!canDelete && !has_missions">
            You do not have permission to delete this project
        </q-tooltip>
        <q-tooltip v-else-if="has_missions">
            You cannot delete a project with missions
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
const props = defineProps<{
    project_uuid: string;
    has_missions: boolean;
}>();

const { data: permissions } = usePermissionsQuery();
const canDelete = computed(
    () =>
        canDeleteProject(props.project_uuid, permissions.value) &&
        !props.has_missions,
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
            project_uuid: props.project_uuid,
        },
    });
};
</script>
