<template>
    <div
        :class="{
            disabled: !canModify,
            'cursor-pointer': !canModify,
            'cursor-not-allowed': canModify,
        }"
        @click="clicked"
    >
        <slot />
        <q-tooltip v-if="!canModify">
            You do not have permission to modify this project
        </q-tooltip>
    </div>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { canModifyProject, usePermissionsQuery } from '../../hooks/query-hooks';
import { computed } from 'vue';
import ModifyProjectTagsDialog from '../../dialogs/modify-project-tags-dialog.vue';

const $q = useQuasar();
const { project_uuid } = defineProps<{ project_uuid: string }>();

const { data: permissions } = usePermissionsQuery();
const canModify = computed(() =>
    canModifyProject(project_uuid, permissions.value),
);

const clicked = (): void => {
    // abort if the user cannot modify the project
    if (!canModify.value) return;

    // open the dialog
    $q.dialog({
        component: ModifyProjectTagsDialog,
        componentProps: {
            projectUUID: project_uuid,
        },
    });
};
</script>

<style scoped>
.disabled {
    opacity: 0.5;
}
</style>
