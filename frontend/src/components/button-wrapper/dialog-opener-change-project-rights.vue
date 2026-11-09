<template>
    <div v-if="canModify" class="cursor-pointer" @click="changeRights">
        <slot />
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import ChangeAccessRightsDialog from 'src/dialogs/modify-access-rights-dialog.vue';
import { canDeleteProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import { computed } from 'vue';

const $q = useQuasar();
const properties = defineProps<{
    projectAccessUuid: string;
    projectUuid: string;
}>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canDeleteProject(properties.projectUuid, permissions.value),
);

const changeRights = (): void => {
    if (!canModify.value) {
        return;
    }
    $q.dialog({
        component: ChangeAccessRightsDialog,
        componentProps: {
            projectUuid: properties.projectUuid,

            // eslint-disable-next-line @typescript-eslint/naming-convention
            project_access_uuid: properties.projectAccessUuid,
        },
    });
};
</script>
