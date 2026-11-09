<template>
    <div v-if="canModify" class="cursor-pointer" @click="manageProjectAccess">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import AccessRightsDialog from 'src/dialogs/modify-access-rights-dialog.vue';
import { canModifyProject, usePermissionsQuery } from 'src/hooks/query-hooks';
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
