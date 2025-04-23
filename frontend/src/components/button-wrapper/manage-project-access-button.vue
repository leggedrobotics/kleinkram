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
import AccessRightsDialog from '../../dialogs/modify-access-rights-dialog.vue';
import { useQuasar } from 'quasar';
import { canModifyProject, usePermissionsQuery } from '@hooks/query-hooks';
import { computed } from 'vue';

const { projectUuid } = defineProps<{
    projectUuid: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(projectUuid, permissions.value),
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
