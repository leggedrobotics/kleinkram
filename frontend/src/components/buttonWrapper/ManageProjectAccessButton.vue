<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="manageProjectAccess"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import AccessRightsDialog from 'src/dialogs/AccessRightsDialog.vue';
import { useQuasar } from 'quasar';
import {
    canModifyProject,
    usePermissionsQuery,
} from 'src/hooks/customQueryHooks';
import { computed } from 'vue';

const { project_uuid } = defineProps({
    project_uuid: String,
});

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(project_uuid, permissions.value),
);

const $q = useQuasar();
const manageProjectAccess = () => {
    // abort if the user cannot modify the project
    if (!canModify.value) return;

    // open the dialog
    $q.dialog({
        title: 'Manage Access',
        component: AccessRightsDialog,
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
