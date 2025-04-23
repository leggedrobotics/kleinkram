<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="changeRights"
    >
        <slot />

        <q-tooltip v-if="!canModify">
            You need delete rights on the project to remove it from this access
            group
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { computed } from 'vue';
import { canDeleteProject, usePermissionsQuery } from 'src/hooks/query-hooks';
import ChangeAccessRightsDialog from 'src/dialogs/modify-access-rights-dialog.vue';

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
            project_access_uuid: properties.projectAccessUuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>

<style scoped></style>
