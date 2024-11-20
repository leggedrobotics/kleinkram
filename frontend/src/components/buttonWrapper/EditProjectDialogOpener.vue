<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="editProjectDialog"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import EditProjectDialog from 'src/dialogs/EditProjectDialog.vue';
import {
    canModifyProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

const $q = useQuasar();
const { project_uuid } = defineProps({
    project_uuid: String,
});

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(project_uuid, permissions.value),
);

const editProjectDialog = () => {
    // abort if the user cannot modify the project
    if (!canModify.value) return;

    // open the dialog
    $q.dialog({
        component: EditProjectDialog,
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
